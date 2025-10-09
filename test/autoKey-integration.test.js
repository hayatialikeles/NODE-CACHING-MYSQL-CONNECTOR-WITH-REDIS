const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const proxyquire = require('proxyquire');

chai.use(sinonChai);
const { expect } = chai;

describe('Auto Key Integration (v2.6.0)', () => {
    let dbConnector;
    let mockPool;
    let mockConnection;
    let mockRedis;
    let getArrayItemStub;
    let addArrayItemStub;
    let delPrefixKeyItemStub;

    beforeEach(() => {
        // Mock connection
        mockConnection = {
            query: sinon.stub(),
            release: sinon.stub()
        };

        // Mock pool
        mockPool = {
            getConnection: sinon.stub().resolves(mockConnection),
            end: sinon.stub().resolves(),
            pool: {
                _allConnections: [1, 2, 3, 4, 5],
                _freeConnections: [1, 2, 3],
                _connectionQueue: []
            }
        };

        // Mock mysql2/promise
        const mockMysql = {
            createPool: sinon.stub().returns(mockPool)
        };

        // Mock redis connector functions
        getArrayItemStub = sinon.stub().resolves([]);
        addArrayItemStub = sinon.stub().resolves([]);
        delPrefixKeyItemStub = sinon.stub().resolves();

        mockRedis = {
            getArrayItem: getArrayItemStub,
            addArrayItem: addArrayItemStub,
            delPrefixKeyItem: delPrefixKeyItemStub
        };

        // Set environment variables
        process.env.DB_HOST = 'localhost';
        process.env.DB_USERNAME = 'root';
        process.env.DB_NAME = 'testdb';
        process.env.REDIS_ENABLED = 'true';
        process.env.REDIS_SERVER = 'localhost';
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.DB_HOST;
        delete process.env.DB_USERNAME;
        delete process.env.DB_NAME;
        delete process.env.REDIS_ENABLED;
        delete process.env.REDIS_SERVER;
        delete process.env.CORE_AUTO_FEATURES;
    });

    describe('Backward Compatibility (v2.5.3 behavior)', () => {
        beforeEach(() => {
            // Auto features disabled (default)
            delete process.env.CORE_AUTO_FEATURES;

            dbConnector = proxyquire('../dbConnector', {
                'mysql2/promise': { createPool: sinon.stub().returns(mockPool) },
                './redis.Connector': mockRedis
            });
        });

        it('should require manual cache key when auto features disabled', async () => {
            try {
                await dbConnector.getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.include('cacheName is required');
                expect(err.message).to.include('CORE_AUTO_FEATURES=true');
            }
        });

        it('should work with manual cache key (v2.5.3 style)', async () => {
            const mockData = [{ id: 123, name: 'Test' }];
            mockConnection.query.resolves([mockData]);

            const result = await dbConnector.getCacheQuery(
                'SELECT * FROM users WHERE id = ?',
                [123],
                'user-123'  // Manual key
            );

            expect(result).to.deep.equal(mockData);
            expect(getArrayItemStub).to.have.been.calledWith('user-123');
            expect(addArrayItemStub).to.have.been.calledWith('user-123', mockData);
        });
    });

    describe('Auto Key Generation (v2.6.0 behavior)', () => {
        beforeEach(() => {
            // Enable auto features
            process.env.CORE_AUTO_FEATURES = 'true';

            dbConnector = proxyquire('../dbConnector', {
                'mysql2/promise': { createPool: sinon.stub().returns(mockPool) },
                './redis.Connector': mockRedis
            });
        });

        it('should auto-generate cache key when not provided', async () => {
            const mockData = [{ id: 123, name: 'Test' }];
            mockConnection.query.resolves([mockData]);

            const result = await dbConnector.getCacheQuery(
                'SELECT * FROM users WHERE id = ?',
                [123]
                // No cacheName!
            );

            expect(result).to.deep.equal(mockData);

            // Should have called getArrayItem with auto-generated key
            const cacheKey = getArrayItemStub.firstCall.args[0];
            expect(cacheKey).to.include('users');
            expect(cacheKey).to.include('id');
        });

        it('should use manual key if provided (backward compatibility)', async () => {
            const mockData = [{ id: 123, name: 'Test' }];
            mockConnection.query.resolves([mockData]);

            const result = await dbConnector.getCacheQuery(
                'SELECT * FROM users WHERE id = ?',
                [123],
                'my-custom-key'  // Manual key takes priority
            );

            expect(result).to.deep.equal(mockData);
            expect(getArrayItemStub).to.have.been.calledWith('my-custom-key');
        });

        it('should generate consistent keys for same query', async () => {
            const mockData = [{ id: 123, name: 'Test' }];
            mockConnection.query.resolves([mockData]);

            // First call
            await dbConnector.getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);
            const key1 = getArrayItemStub.firstCall.args[0];

            // Second call with same params
            getArrayItemStub.resetHistory();
            await dbConnector.getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);
            const key2 = getArrayItemStub.firstCall.args[0];

            expect(key1).to.equal(key2);
        });

        it('should generate different keys for different params', async () => {
            const mockData = [{ id: 123, name: 'Test' }];
            mockConnection.query.resolves([mockData]);

            // First call
            await dbConnector.getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);
            const key1 = getArrayItemStub.firstCall.args[0];

            // Second call with different params
            getArrayItemStub.resetHistory();
            mockConnection.query.resolves([mockData]);
            await dbConnector.getCacheQuery('SELECT * FROM users WHERE id = ?', [456]);
            const key2 = getArrayItemStub.firstCall.args[0];

            expect(key1).to.not.equal(key2);
        });

        it('should work with cache hit', async () => {
            const cachedData = [{ id: 123, name: 'Cached User' }];
            getArrayItemStub.resolves(cachedData);

            const result = await dbConnector.getCacheQuery(
                'SELECT * FROM users WHERE id = ?',
                [123]
            );

            expect(result).to.deep.equal(cachedData);
            expect(mockConnection.query).to.not.have.been.called; // Should not hit DB
        });

        it('should handle database switching with auto key', async () => {
            const mockData = [{ id: 1, product: 'Widget' }];
            mockConnection.query.resolves([mockData]);

            await dbConnector.getCacheQuery(
                'SELECT * FROM products WHERE id = ?',
                [1],
                null,  // No manual key
                'analytics_db'  // Different database
            );

            // Should have switched database
            expect(mockConnection.query.firstCall.args[0]).to.include('USE');
            expect(mockConnection.query.firstCall.args[0]).to.include('analytics_db');

            // Should have auto-generated key
            const cacheKey = getArrayItemStub.firstCall.args[0];
            expect(cacheKey).to.include('products');
        });
    });

    describe('Mixed Usage Scenarios', () => {
        beforeEach(() => {
            process.env.CORE_AUTO_FEATURES = 'true';

            dbConnector = proxyquire('../dbConnector', {
                'mysql2/promise': { createPool: sinon.stub().returns(mockPool) },
                './redis.Connector': mockRedis
            });
        });

        it('should handle both auto and manual keys in same application', async () => {
            const mockData = [{ id: 123 }];
            mockConnection.query.resolves([mockData]);

            // Manual key
            await dbConnector.getCacheQuery(
                'SELECT * FROM users WHERE id = ?',
                [123],
                'user-123'
            );
            expect(getArrayItemStub.firstCall.args[0]).to.equal('user-123');

            // Auto key
            getArrayItemStub.resetHistory();
            mockConnection.query.resolves([mockData]);
            await dbConnector.getCacheQuery(
                'SELECT * FROM orders WHERE id = ?',
                [456]
                // No manual key
            );
            const autoKey = getArrayItemStub.firstCall.args[0];
            expect(autoKey).to.include('orders');
            expect(autoKey).to.not.equal('user-123');
        });
    });

    describe('Real-world Query Patterns', () => {
        beforeEach(() => {
            process.env.CORE_AUTO_FEATURES = 'true';

            dbConnector = proxyquire('../dbConnector', {
                'mysql2/promise': { createPool: sinon.stub().returns(mockPool) },
                './redis.Connector': mockRedis
            });
        });

        it('should handle simple lookup query', async () => {
            const mockData = [{ id: 123, name: 'John Doe' }];
            mockConnection.query.resolves([mockData]);

            await dbConnector.getCacheQuery(
                'SELECT * FROM users WHERE id = ?',
                [123]
            );

            const key = getArrayItemStub.firstCall.args[0];
            expect(key).to.match(/users:id:[a-f0-9]{8}/);
        });

        it('should handle filtered list query', async () => {
            const mockData = [{ id: 1 }, { id: 2 }];
            mockConnection.query.resolves([mockData]);

            await dbConnector.getCacheQuery(
                'SELECT * FROM orders WHERE user_id = ? AND status = ?',
                [123, 'active']
            );

            const key = getArrayItemStub.firstCall.args[0];
            expect(key).to.include('orders');
        });

        it('should handle pagination query', async () => {
            const mockData = [{ id: 1 }, { id: 2 }, { id: 3 }];
            mockConnection.query.resolves([mockData]);

            await dbConnector.getCacheQuery(
                'SELECT * FROM products WHERE category = ? ORDER BY price LIMIT 10 OFFSET 20',
                [5]
            );

            const key = getArrayItemStub.firstCall.args[0];
            expect(key).to.include('products');
        });

        it('should handle complex multi-condition query', async () => {
            const mockData = [{ id: 1 }];
            mockConnection.query.resolves([mockData]);

            await dbConnector.getCacheQuery(
                'SELECT * FROM shipments WHERE user_id = ? AND status = ? AND created_at > ? AND region = ?',
                [123, 'pending', '2025-01-01', 'TR']
            );

            const key = getArrayItemStub.firstCall.args[0];
            expect(key).to.include('shipments');
            // Should use hash-based key for 4+ params
            expect(key).to.match(/shipments:[a-f0-9]{8}/);
        });
    });
});
