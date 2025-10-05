const { expect } = require('chai');

describe('index.js - Main Export', () => {
    let index;

    before(() => {
        // Set required environment variables before loading
        process.env.DB_HOST = 'localhost';
        process.env.DB_USERNAME = 'test';
        process.env.DB_NAME = 'testdb';
        process.env.REDIS_SERVER = 'localhost';
        process.env.REDIS_PORT = '6379';

        // Now load the module
        index = require('../index');
    });

    after(() => {
        // Clean up
        delete process.env.DB_HOST;
        delete process.env.DB_USERNAME;
        delete process.env.DB_NAME;
        delete process.env.REDIS_SERVER;
        delete process.env.REDIS_PORT;
    });
    it('should export all database functions', () => {
        expect(index).to.have.property('QuaryCache');
        expect(index).to.have.property('getCacheQuery');
        expect(index).to.have.property('getCacheQueryPagination');

        expect(index.QuaryCache).to.be.a('function');
        expect(index.getCacheQuery).to.be.a('function');
        expect(index.getCacheQueryPagination).to.be.a('function');
    });

    it('should export all Redis functions', () => {
        expect(index).to.have.property('getArrayItem');
        expect(index).to.have.property('addArrayItem');
        expect(index).to.have.property('delKeyItem');
        expect(index).to.have.property('delPrefixKeyItem');
        expect(index).to.have.property('getRedisClient');

        expect(index.getArrayItem).to.be.a('function');
        expect(index.addArrayItem).to.be.a('function');
        expect(index.delKeyItem).to.be.a('function');
        expect(index.delPrefixKeyItem).to.be.a('function');
        expect(index.getRedisClient).to.be.a('function');
    });

    it('should export exactly 8 functions', () => {
        const exportedKeys = Object.keys(index);
        expect(exportedKeys).to.have.lengthOf(8);
    });

    it('should have correct function names', () => {
        const expectedFunctions = [
            'QuaryCache',
            'getCacheQuery',
            'getCacheQueryPagination',
            'getArrayItem',
            'addArrayItem',
            'delKeyItem',
            'delPrefixKeyItem',
            'getRedisClient'
        ];

        const exportedKeys = Object.keys(index);
        expectedFunctions.forEach(funcName => {
            expect(exportedKeys).to.include(funcName);
        });
    });

    it('should allow destructuring import pattern', () => {
        const {
            QuaryCache,
            getCacheQuery,
            getCacheQueryPagination,
            getArrayItem,
            addArrayItem,
            delKeyItem,
            delPrefixKeyItem,
            getRedisClient
        } = index;

        expect(QuaryCache).to.be.a('function');
        expect(getCacheQuery).to.be.a('function');
        expect(getCacheQueryPagination).to.be.a('function');
        expect(getArrayItem).to.be.a('function');
        expect(addArrayItem).to.be.a('function');
        expect(delKeyItem).to.be.a('function');
        expect(delPrefixKeyItem).to.be.a('function');
        expect(getRedisClient).to.be.a('function');
    });

    describe('Backward Compatibility (v2.4.x)', () => {
        it('should support v2.4.x style usage (dbConnector.functionName)', () => {
            // Old style - direct property access
            expect(index.QuaryCache).to.be.a('function');
            expect(index.getCacheQuery).to.be.a('function');
            expect(index.getCacheQueryPagination).to.be.a('function');
        });

        it('should support both old and new import styles simultaneously', () => {
            // Simulate old code
            const dbConnector = index;
            expect(dbConnector.QuaryCache).to.be.a('function');

            // Simulate new code in same codebase
            const { getCacheQuery } = index;
            expect(getCacheQuery).to.be.a('function');

            // Both should reference same function
            expect(dbConnector.getCacheQuery).to.equal(getCacheQuery);
        });

        it('should maintain function references across import styles', () => {
            const dbConnector = index;
            const { QuaryCache, getCacheQuery, getArrayItem } = index;

            // Verify they're the same functions
            expect(dbConnector.QuaryCache).to.equal(QuaryCache);
            expect(dbConnector.getCacheQuery).to.equal(getCacheQuery);
            expect(dbConnector.getArrayItem).to.equal(getArrayItem);
        });
    });
});
