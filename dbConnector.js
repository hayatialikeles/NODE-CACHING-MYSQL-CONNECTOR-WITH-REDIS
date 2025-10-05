const db = require('mysql2/promise');
const { getArrayItem, addArrayItem, delPrefixKeyItem } = require('./redis.Connector');
require('dotenv').config();
const env = process.env;

// Check if Redis is enabled (default: true)
const REDIS_ENABLED = env.REDIS_ENABLED !== 'false';

// Validate required database configuration
if (!env.DB_HOST || !env.DB_USERNAME || !env.DB_NAME) {
    throw new Error('Missing required database configuration: DB_HOST, DB_USERNAME, and DB_NAME must be set');
}

const con = db.createPool({
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
});

// Retry helper function with optional database switching
async function executeWithRetry(fn, retries = 3, delay = 1000, database = null) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn(database);
        } catch (error) {
            if (i === retries - 1) throw error;

            // Retry only on connection errors
            if (error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
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
                if (resetCacheName && REDIS_ENABLED) {
                    await delPrefixKeyItem(resetCacheName);
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
     * @param {string} sql - The SQL query to be executed.
     * @param {Array} parameters - The parameters to be passed to the SQL query.
     * @param {string} cacheName - The name of the cache to store the data.
     * @param {string|null} database - The database name to switch to (optional).
     * @returns {Promise<Array>} - A promise that resolves to the retrieved data.
     * @throws {Error} - If there is an error while retrieving the data.
     */
    async getCacheQuery(sql, parameters, cacheName, database = null) {
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
    }
};
