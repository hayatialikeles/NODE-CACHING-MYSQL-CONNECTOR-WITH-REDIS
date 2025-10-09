const db = require('mysql2/promise');
const { getArrayItem, addArrayItem, delPrefixKeyItem } = require('./redis.Connector');
const { generateCacheKey, isAutoKeyEnabled } = require('./core/autoKey');
const { determineInvalidationPatterns } = require('./core/autoInvalidate');
require('dotenv').config();
const env = process.env;

// Check if Redis is enabled (default: true)
const REDIS_ENABLED = env.REDIS_ENABLED !== 'false';

/**
 * Validates required environment variables and provides helpful error messages
 * @throws {Error} If any required configuration is missing
 */
function validateConfiguration() {
    const errors = [];

    // Required configurations
    if (!env.DB_HOST) {
        errors.push('DB_HOST is required (e.g., DB_HOST=localhost)');
    }

    if (!env.DB_USERNAME) {
        errors.push('DB_USERNAME is required (e.g., DB_USERNAME=root)');
    }

    if (!env.DB_NAME) {
        errors.push('DB_NAME is required (e.g., DB_NAME=my_database)');
    }

    // Validate optional numeric values if provided
    if (env.DB_PORT && isNaN(parseInt(env.DB_PORT))) {
        errors.push('DB_PORT must be a valid number (e.g., DB_PORT=3306)');
    }

    if (env.DB_CONNECTION_LIMIT && isNaN(parseInt(env.DB_CONNECTION_LIMIT))) {
        errors.push('DB_CONNECTION_LIMIT must be a valid number (e.g., DB_CONNECTION_LIMIT=10)');
    }

    if (env.DB_QUEUE_LIMIT && isNaN(parseInt(env.DB_QUEUE_LIMIT))) {
        errors.push('DB_QUEUE_LIMIT must be a valid number (e.g., DB_QUEUE_LIMIT=0)');
    }

    if (env.DB_CONNECT_TIMEOUT && isNaN(parseInt(env.DB_CONNECT_TIMEOUT))) {
        errors.push('DB_CONNECT_TIMEOUT must be a valid number in milliseconds (e.g., DB_CONNECT_TIMEOUT=10000)');
    }

    // Validate Redis configuration if enabled
    if (REDIS_ENABLED) {
        if (!env.REDIS_SERVER) {
            errors.push('REDIS_SERVER is required when Redis is enabled (e.g., REDIS_SERVER=localhost). Set REDIS_ENABLED=false to disable Redis.');
        }

        if (env.REDIS_PORT && isNaN(parseInt(env.REDIS_PORT))) {
            errors.push('REDIS_PORT must be a valid number (e.g., REDIS_PORT=6379)');
        }
    }

    if (errors.length > 0) {
        const errorMessage = [
            '❌ Configuration Error - Missing or invalid environment variables:',
            '',
            ...errors.map(err => `  • ${err}`),
            '',
            '💡 Tip: Copy .env.example to .env and configure your settings:',
            '  cp .env.example .env',
            ''
        ].join('\n');

        throw new Error(errorMessage);
    }
}

// Validate configuration on module load
validateConfiguration();

// Connection pool configuration with auto-reconnection
const poolConfig = {
    host: env.DB_HOST,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME,
    connectionLimit: parseInt(env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: parseInt(env.DB_QUEUE_LIMIT) || 0,
    connectTimeout: parseInt(env.DB_CONNECT_TIMEOUT) || 10000,
    multipleStatements: env.DB_MULTIPLE_STATEMENTS === 'true' || false,
    port: parseInt(env.DB_PORT) || 3306,
    timezone: env.TIMEZONE || '+00:00',
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

const con = db.createPool(poolConfig);

// Graceful shutdown flag
let isShuttingDown = false;

// Retry helper function with optional database switching and timeout protection
async function executeWithRetry(fn, retries = 3, delay = 1000, database = null, timeout = null) {
    for (let i = 0; i < retries; i++) {
        try {
            if (isShuttingDown) {
                throw new Error('Server is shutting down, cannot process new queries');
            }

            if (timeout) {
                return await Promise.race([
                    fn(database),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Query timeout exceeded')), timeout)
                    )
                ]);
            }

            return await fn(database);
        } catch (error) {
            if (i === retries - 1) throw error;

            // Retry only on connection errors
            if (error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
                error.code === 'PROTOCOL_CONNECTION_LOST' ||
                error.code === 'ER_CON_COUNT_ERROR') {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            } else {
                throw error;
            }
        }
    }
}

module.exports = {
    /**
     * Executes a SQL query and returns the result from the cache or the database.
     * If a resetCacheName is provided, it deletes the cache item before executing the query.
     *
     * v2.6.0: resetCacheName is now optional. If not provided and CORE_AUTO_INVALIDATION=true,
     * cache will be auto-invalidated based on the affected table.
     *
     * @param {string} sql - The SQL query to execute.
     * @param {Array} parameters - The parameters to be passed to the SQL query.
     * @param {string|null} resetCacheName - The name of the cache item to reset (optional).
     * @param {string|null} database - The database name to switch to (optional).
     * @returns {Promise<any>} - A promise that resolves with the result of the query.
     * @throws {Error} - If an error occurs during the query execution.
     */
    async QuaryCache(sql, parameters, resetCacheName = null, database = null) {
        return executeWithRetry(async (db) => {
            let connection;
            try {
                connection = await con.getConnection();
                if (db) {
                    await connection.query(`USE \`${db}\``);
                }
                const [data] = await connection.query(sql, parameters);

                // Determine which cache patterns to invalidate
                if (REDIS_ENABLED) {
                    const patterns = determineInvalidationPatterns(sql, resetCacheName);

                    if (patterns.length > 0) {
                        await Promise.all(
                            patterns.map(pattern => delPrefixKeyItem(pattern))
                        );
                    }
                }

                return data;
            } catch (err) {
                throw err;
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }, 3, 1000, database);
    },
    /**
     * Retrieves data from cache or database based on the provided SQL query and parameters.
     * If the data is found in the cache, it is returned. Otherwise, the data is fetched from the database,
     * stored in the cache, and then returned.
     *
     * v2.6.0: cacheName is now optional. If not provided and CORE_AUTO_FEATURES=true,
     * a cache key will be auto-generated from the SQL query and parameters.
     *
     * @param {string} sql - The SQL query to be executed.
     * @param {Array} parameters - The parameters to be passed to the SQL query.
     * @param {string|null} cacheName - The name of the cache to store the data (optional if auto-key enabled).
     * @param {string|null} database - The database name to switch to (optional).
     * @returns {Promise<Array>} - A promise that resolves to the retrieved data.
     * @throws {Error} - If there is an error while retrieving the data.
     */
    async getCacheQuery(sql, parameters, cacheName = null, database = null) {
        // Auto-generate cache key if not provided and feature is enabled
        let finalCacheName = cacheName;

        if (!finalCacheName) {
            if (isAutoKeyEnabled()) {
                finalCacheName = generateCacheKey(sql, parameters);
            } else {
                throw new Error(
                    'cacheName is required. To enable auto key generation, set CORE_AUTO_FEATURES=true in .env'
                );
            }
        }

        return executeWithRetry(async (db) => {
            let connection;
            try {
                if (REDIS_ENABLED) {
                    const cachedData = await getArrayItem(finalCacheName);
                    if (cachedData.length > 0) {
                        return cachedData;
                    }
                }

                connection = await con.getConnection();
                if (db) {
                    await connection.query(`USE \`${db}\``);
                }
                const [data] = await connection.query(sql, parameters);

                if (REDIS_ENABLED) {
                    await addArrayItem(finalCacheName, data);
                }

                return data;
            } catch (err) {
                throw err;
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }, 3, 1000, database);
    },

    /**
     * Retrieves paginated data from cache or database based on the provided SQL query and parameters.
     * If the data is available in cache, it is returned directly. Otherwise, the data is fetched from the database,
     * paginated, and then stored in the cache for future use.
     *
     * @param {string} sql - The SQL query to execute.
     * @param {Array} parameters - The parameters to be used in the SQL query.
     * @param {string} cacheName - The name of the cache to store the data.
     * @param {number} page - The page number of the data to retrieve.
     * @param {number} [pageSize=30] - The number of records per page. Defaults to 30 if not provided.
     * @param {string|null} database - The database name to switch to (optional).
     * @returns {Promise<Object>} - A promise that resolves to an object containing the paginated data.
     * @throws {Error} - If an error occurs during the execution of the function.
     */
    async getCacheQueryPagination(sql, parameters, cacheName, page, pageSize = 30, database = null) {
        return executeWithRetry(async (db) => {
            let connection;
            try {
                // Validate pageSize to prevent division by zero
                if (pageSize <= 0) {
                    throw new Error('Page size must be greater than 0');
                }

                if (REDIS_ENABLED) {
                    const cachedData = await getArrayItem(cacheName);
                    if (typeof cachedData === 'object' && !Array.isArray(cachedData) && cachedData !== null) {
                        return cachedData;
                    }
                }

                connection = await con.getConnection();
                if (db) {
                    await connection.query(`USE \`${db}\``);
                }

            // Get total count with original query
            const [allData] = await connection.query(sql, parameters);
            const totalCount = allData.length;

            // Modify SQL for pagination
            const offset = page * pageSize;
            const paginatedSql = `${sql} LIMIT ${offset}, ${pageSize}`;

            // Get paginated data
            const [data] = await connection.query(paginatedSql, parameters);

            // Prepare result
            const result = {
                totalCount,
                pageCount: Math.ceil(totalCount / pageSize),
                detail: data
            };

                if (REDIS_ENABLED) {
                    await addArrayItem(cacheName, result);
                }

                return result;
            } catch (err) {
                throw err;
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }, 3, 1000, database);
    },

    /**
     * Executes a bulk insert operation with chunking for large datasets.
     * Automatically splits large datasets into chunks to prevent memory issues.
     *
     * @param {string} table - The table name to insert into.
     * @param {Array} records - Array of objects with column-value pairs.
     * @param {Object} options - Optional settings: { database, chunkSize, resetCacheName }
     * @returns {Promise<Object>} - A promise that resolves with insert statistics.
     * @throws {Error} - If an error occurs during the bulk insert.
     */
    async bulkInsert(table, records, options = {}) {
        const { database = null, chunkSize = 1000, resetCacheName = null } = options;

        if (!records || records.length === 0) {
            return { insertedRows: 0, chunks: 0 };
        }

        return executeWithRetry(async (db) => {
            let connection;
            try {
                connection = await con.getConnection();
                if (db) {
                    await connection.query(`USE \`${db}\``);
                }

                const columns = Object.keys(records[0]);
                let totalInserted = 0;
                let chunks = 0;

                // Process in chunks
                for (let i = 0; i < records.length; i += chunkSize) {
                    const chunk = records.slice(i, i + chunkSize);
                    const values = chunk.map(record =>
                        columns.map(col => record[col])
                    );

                    const placeholders = chunk.map(() =>
                        `(${columns.map(() => '?').join(',')})`
                    ).join(',');

                    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`;
                    const flatValues = values.flat();

                    const [result] = await connection.query(sql, flatValues);
                    totalInserted += result.affectedRows;
                    chunks++;
                }

                if (resetCacheName && REDIS_ENABLED) {
                    await delPrefixKeyItem(resetCacheName);
                }

                return { insertedRows: totalInserted, chunks };
            } catch (err) {
                throw err;
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }, 3, 1000, database);
    },

    /**
     * Executes a query with timeout protection.
     * Prevents long-running queries from blocking the application.
     *
     * @param {string} sql - The SQL query to execute.
     * @param {Array} parameters - The parameters to be passed to the SQL query.
     * @param {string} cacheName - The name of the cache.
     * @param {Object} options - Optional settings: { timeout, database }
     * @returns {Promise<any>} - A promise that resolves with the result of the query.
     * @throws {Error} - If timeout is exceeded or query fails.
     */
    async getCacheQueryWithTimeout(sql, parameters, cacheName, options = {}) {
        const { timeout = 30000, database = null } = options;
        return executeWithRetry(async (db) => {
            let connection;
            try {
                if (REDIS_ENABLED) {
                    const cachedData = await getArrayItem(cacheName);
                    if (cachedData.length > 0) {
                        return cachedData;
                    }
                }

                connection = await con.getConnection();
                if (db) {
                    await connection.query(`USE \`${db}\``);
                }
                const [data] = await connection.query(sql, parameters);

                if (REDIS_ENABLED) {
                    await addArrayItem(cacheName, data);
                }

                return data;
            } catch (err) {
                throw err;
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }, 3, 1000, database, timeout);
    },

    /**
     * Gracefully closes all database connections.
     * Should be called during application shutdown to prevent connection leaks.
     *
     * @returns {Promise<void>}
     */
    async closeConnections() {
        isShuttingDown = true;
        console.log('Closing database connections gracefully...');
        await con.end();
        console.log('Database pool closed');
    },

    /**
     * Gets current pool statistics for monitoring.
     *
     * @returns {Object} - Pool statistics including active connections.
     */
    getPoolStats() {
        return {
            totalConnections: con.pool._allConnections.length,
            activeConnections: con.pool._allConnections.length - con.pool._freeConnections.length,
            freeConnections: con.pool._freeConnections.length,
            queuedRequests: con.pool._connectionQueue.length
        };
    },

    /**
     * Executes queries within a database transaction.
     * Automatically commits on success or rolls back on error.
     * Cache invalidation is buffered and applied only on successful commit.
     *
     * @param {Function} callback - Async function that receives transaction context (tx)
     * @param {Object} options - Transaction options
     * @param {string|null} options.database - Database to switch to (optional)
     * @returns {Promise<any>} - Result of the callback function
     * @throws {Error} - If transaction fails or is rolled back
     *
     * @example
     * await withTransaction(async (tx) => {
     *     await tx.query('INSERT INTO users...', [data]);
     *     await tx.query('UPDATE orders...', [data]);
     *     // Auto commit on success, auto rollback on error
     * });
     */
    async withTransaction(callback, options = {}) {
        const { database = null } = options;
        let connection;
        const invalidationBuffer = []; // Buffer cache patterns for commit

        try {
            if (isShuttingDown) {
                throw new Error('Server is shutting down, cannot process new transactions');
            }

            connection = await con.getConnection();

            // Switch database if specified
            if (database) {
                await connection.query(`USE \`${database}\``);
            }

            // Begin transaction
            await connection.beginTransaction();

            // Create transaction context
            const tx = {
                /**
                 * Execute a query within the transaction
                 * @param {string} sql - SQL query
                 * @param {Array} parameters - Query parameters
                 * @param {string|string[]|null} resetCacheName - Cache patterns to invalidate on commit
                 * @returns {Promise<any>} - Query result
                 */
                query: async (sql, parameters, resetCacheName = null) => {
                    const [data] = await connection.query(sql, parameters);

                    // Buffer cache invalidation patterns
                    if (REDIS_ENABLED) {
                        const patterns = determineInvalidationPatterns(sql, resetCacheName);
                        if (patterns.length > 0) {
                            invalidationBuffer.push(...patterns);
                        }
                    }

                    return data;
                },

                /**
                 * Execute a cached read query within the transaction
                 * Note: Reads from cache, but doesn't guarantee transaction isolation
                 * @param {string} sql - SQL query
                 * @param {Array} parameters - Query parameters
                 * @param {string|null} cacheName - Cache key (optional if auto-key enabled)
                 * @returns {Promise<any>} - Query result
                 */
                getCacheQuery: async (sql, parameters, cacheName = null) => {
                    // Auto-generate cache key if needed
                    let finalCacheName = cacheName;
                    if (!finalCacheName) {
                        if (isAutoKeyEnabled()) {
                            finalCacheName = generateCacheKey(sql, parameters);
                        } else {
                            throw new Error(
                                'cacheName is required in transaction. To enable auto key generation, set CORE_AUTO_FEATURES=true'
                            );
                        }
                    }

                    // Check cache first
                    if (REDIS_ENABLED) {
                        const cachedData = await getArrayItem(finalCacheName);
                        if (cachedData.length > 0) {
                            return cachedData;
                        }
                    }

                    // Execute in transaction and cache result
                    const [data] = await connection.query(sql, parameters);
                    if (REDIS_ENABLED) {
                        await addArrayItem(finalCacheName, data);
                    }

                    return data;
                },

                /**
                 * Get the underlying connection object
                 * For advanced use cases that need direct connection access
                 * @returns {Object} - MySQL connection object
                 */
                getConnection: () => connection
            };

            // Execute user callback
            const result = await callback(tx);

            // Commit transaction
            await connection.commit();

            // Apply buffered cache invalidations on successful commit
            if (REDIS_ENABLED && invalidationBuffer.length > 0) {
                // Remove duplicates
                const uniquePatterns = [...new Set(invalidationBuffer)];
                await Promise.all(
                    uniquePatterns.map(pattern => delPrefixKeyItem(pattern))
                );
            }

            return result;
        } catch (error) {
            // Rollback on error
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('Rollback error:', rollbackError);
                }
            }
            throw error;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
};
