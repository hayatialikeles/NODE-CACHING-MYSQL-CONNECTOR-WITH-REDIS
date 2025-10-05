const dbConnector = require('./dbConnector');
const redisConnector = require('./redis.Connector');

module.exports = {
    // Database functions
    QuaryCache: dbConnector.QuaryCache,
    getCacheQuery: dbConnector.getCacheQuery,
    getCacheQueryPagination: dbConnector.getCacheQueryPagination,

    // Production-grade features (v2.5.3+)
    bulkInsert: dbConnector.bulkInsert,
    getCacheQueryWithTimeout: dbConnector.getCacheQueryWithTimeout,
    closeConnections: dbConnector.closeConnections,
    getPoolStats: dbConnector.getPoolStats,

    // Redis functions
    getArrayItem: redisConnector.getArrayItem,
    addArrayItem: redisConnector.addArrayItem,
    delKeyItem: redisConnector.delKeyItem,
    delPrefixKeyItem: redisConnector.delPrefixKeyItem,
    getRedisClient: redisConnector.getRedisClient
};