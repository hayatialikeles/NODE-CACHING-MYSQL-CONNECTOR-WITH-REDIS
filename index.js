const dbConnector = require('./dbConnector');
const redisConnector = require('./redis.Connector');
const { enableAutoKey } = require('./core/autoKey');
const { enableAutoInvalidation } = require('./core/autoInvalidate');

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

    // Transaction support (v2.7.0+)
    withTransaction: dbConnector.withTransaction,

    // Redis functions
    getArrayItem: redisConnector.getArrayItem,
    addArrayItem: redisConnector.addArrayItem,
    delKeyItem: redisConnector.delKeyItem,
    delPrefixKeyItem: redisConnector.delPrefixKeyItem,
    isRedisConnected: redisConnector.isRedisConnected,
    getRedisClient: redisConnector.getRedisClient,

    // v2.6.0 Core Features (Opt-in)
    enableAutoKey,
    enableAutoInvalidation,

    // All-in-one configuration helper
    configure(config = {}) {
        if (config.autoKey !== undefined) {
            enableAutoKey(config.autoKey);
        }
        if (config.autoInvalidation !== undefined) {
            enableAutoInvalidation(config.autoInvalidation);
        }
    }
};