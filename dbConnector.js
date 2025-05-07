const db = require('mysql2/promise');
const { getArrayItem, addArrayItem, delPrefixKeyItem } = require('./redis.Connector');
require('dotenv').config();
const env = process.env;
const con = db.createPool({
    host: env.DB_HOST,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 100, // Default 10
    queueLimit: 20,
    connectTimeout: 1000000,  // acquireTimeout yerine connectTimeout kullanıldı
    multipleStatements: true,
    port: env.DB_PORT,
    timezone: env?.TIMEZONE ?? '+00:00',  // Null coalescing operator kullanımı
});

module.exports = {
    /**
     * Executes a SQL query and returns the result from the cache or the database.
     * If a resetCacheName is provided, it deletes the cache item before executing the query.
     *
     * @param {string} sql - The SQL query to execute.
     * @param {Array} parameters - The parameters to be passed to the SQL query.
     * @param {string|null} resetCacheName - The name of the cache item to reset (optional).
     * @returns {Promise<any>} - A promise that resolves with the result of the query.
     * @throws {Error} - If an error occurs during the query execution.
     */
    async QuaryCache(sql, parameters, resetCacheName = null) {
        let connection;
        try {
            connection = await con.getConnection();
            const [data] = await connection.query(sql, parameters);
            if (resetCacheName) {
                await delPrefixKeyItem(resetCacheName);
            }
            return data;
        } catch (err) {
            throw new Error(err.message);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
    /**
     * Retrieves data from cache or database based on the provided SQL query and parameters.
     * If the data is found in the cache, it is returned. Otherwise, the data is fetched from the database,
     * stored in the cache, and then returned.
     *
     * @param {string} sql - The SQL query to be executed.
     * @param {Array} parameters - The parameters to be passed to the SQL query.
     * @param {string} cacheName - The name of the cache to store the data.
     * @returns {Promise<Array>} - A promise that resolves to the retrieved data.
     * @throws {Error} - If there is an error while retrieving the data.
     */
    async getCacheQuery(sql, parameters, cacheName) {
        let connection;
        try {
            const cachedData = await getArrayItem(cacheName);

            if (cachedData.length > 0) {
                return cachedData;
            }

            connection = await con.getConnection();
            const [data] = await connection.query(sql, parameters);
            await addArrayItem(cacheName, data);
            return data;
        } catch (err) {
            throw new Error(err.message);
        } finally {
            if (connection) {
                connection.release();
            }
        }
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
     * @returns {Promise<Object>} - A promise that resolves to an object containing the paginated data.
     * @throws {Error} - If an error occurs during the execution of the function.
     */
    async getCacheQueryPagination(sql, parameters, cacheName, page, pageSize = 30) {
        let connection;
        try {
            const cachedData = await getArrayItem(cacheName);
    
            if (typeof cachedData === 'object' && !Array.isArray(cachedData) && cachedData !== null) {
                return cachedData;
            }
    
            connection = await con.getConnection();
    
            // Get total count with original query
            const [allData] = await connection.query(sql, parameters);
            const filteredData = allData.filter(r => r.id > 0);
            const totalCount = filteredData.length;
    
            // Modify SQL for pagination
            const offset = page * pageSize;
            const paginatedSql = `${sql} LIMIT ${offset}, ${pageSize}`;
    
            // Get paginated data
            const [data] = await connection.query(paginatedSql, parameters);
    
            // Prepare result
            const result = {
                totalCount,
                pageCount: Math.ceil(totalCount / pageSize),
                detail: data.filter(r => r.id > 0)
            };
    
            await addArrayItem(cacheName, result);
            return result;
        } catch (err) {
            throw new Error(err.message);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
};
