const dbConnector = require('./dbConnector');
const redisConnector = require('./redis.Connector');

module.exports = {
    // Database functions
    QuaryCache: dbConnector.QuaryCache,
    getCacheQuery: dbConnector.getCacheQuery,
    getCacheQueryPagination: dbConnector.getCacheQueryPagination,

    // Redis functions
    getArrayItem: redisConnector.getArrayItem,
    addArrayItem: redisConnector.addArrayItem,
    delKeyItem: redisConnector.delKeyItem,
    delPrefixKeyItem: redisConnector.delPrefixKeyItem,
    getRedisClient: redisConnector.getRedisClient
};