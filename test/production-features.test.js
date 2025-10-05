const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Production Features (v2.5.3+)', () => {
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

        // Mock pool with stats
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

        // Load module with mocks
        dbConnector = proxyquire('../dbConnector', {
            'mysql2/promise': mockMysql,
            './redis.Connector': mockRedis
        });
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.DB_HOST;
        delete process.env.DB_USERNAME;
        delete process.env.DB_NAME;
        delete process.env.REDIS_ENABLED;
        delete process.env.REDIS_SERVER;
    });

    describe('bulkInsert', () => {
        it('should insert records in single chunk when under chunkSize', async () => {
            const records = [
                { name: 'Alice', email: 'alice@example.com' },
                { name: 'Bob', email: 'bob@example.com' }
            ];

            mockConnection.query.resolves([{ affectedRows: 2 }]);

            const result = await dbConnector.bulkInsert('users', records);

            expect(result).to.deep.equal({ insertedRows: 2, chunks: 1 });
            expect(mockConnection.query.callCount).to.equal(1);
            expect(mockConnection.release.callCount).to.equal(1);
        });

        it('should split large datasets into multiple chunks', async () => {
            const records = [];
            for (let i = 0; i < 2500; i++) {
                records.push({ id: i, name: `User${i}` });
            }

            mockConnection.query.resolves([{ affectedRows: 1000 }]);

            const result = await dbConnector.bulkInsert('users', records, { chunkSize: 1000 });

            expect(result.chunks).to.equal(3); // 1000 + 1000 + 500
            expect(result.insertedRows).to.equal(3000); // 3 chunks * 1000 affectedRows
            expect(mockConnection.query.callCount).to.equal(3);
        });

        it('should handle empty records array', async () => {
            const result = await dbConnector.bulkInsert('users', []);

            expect(result).to.deep.equal({ insertedRows: 0, chunks: 0 });
            expect(mockConnection.query.callCount).to.equal(0);
        });

        it('should switch database when database option is provided', async () => {
            const records = [{ name: 'Test' }];
            mockConnection.query.resolves([{ affectedRows: 1 }]);

            await dbConnector.bulkInsert('users', records, { database: 'other_db' });

            expect(mockConnection.query.firstCall.args[0]).to.include('USE `other_db`');
        });

        it('should reset cache when resetCacheName is provided', async () => {
            const records = [{ name: 'Test' }];
            mockConnection.query.resolves([{ affectedRows: 1 }]);

            await dbConnector.bulkInsert('users', records, { resetCacheName: 'users_' });

            expect(delPrefixKeyItemStub.calledWith('users_')).to.be.true;
        });

        it('should release connection on error', async () => {
            const records = [{ name: 'Test' }];
            mockConnection.query.rejects(new Error('Insert failed'));

            try {
                await dbConnector.bulkInsert('users', records);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('Insert failed');
                expect(mockConnection.release.called).to.be.true;
            }
        });
    });

    describe('getCacheQueryWithTimeout', () => {
        it('should return cached data if available', async () => {
            const cachedData = [{ id: 1, name: 'Cached' }];
            getArrayItemStub.resolves(cachedData);

            const result = await dbConnector.getCacheQueryWithTimeout(
                'SELECT * FROM users',
                [],
                'users-cache',
                { timeout: 5000 }
            );

            expect(result).to.deep.equal(cachedData);
            expect(mockConnection.query.called).to.be.false;
        });

        it('should query database and cache result on cache miss', async () => {
            const dbData = [{ id: 1, name: 'Test' }];
            getArrayItemStub.resolves([]);
            mockConnection.query.resolves([dbData]);

            const result = await dbConnector.getCacheQueryWithTimeout(
                'SELECT * FROM users',
                [],
                'users-cache',
                { timeout: 5000 }
            );

            expect(result).to.deep.equal(dbData);
            expect(addArrayItemStub.calledWith('users-cache', dbData)).to.be.true;
        });

        it('should throw error when timeout is exceeded', async function() {
            this.timeout(10000);

            getArrayItemStub.resolves([]);
            mockConnection.query.callsFake(() => {
                return new Promise(resolve => setTimeout(() => resolve([[{ id: 1 }]]), 2000));
            });

            try {
                await dbConnector.getCacheQueryWithTimeout(
                    'SELECT * FROM users',
                    [],
                    'users-cache',
                    { timeout: 100 }
                );
                expect.fail('Should have thrown timeout error');
            } catch (err) {
                expect(err.message).to.include('Query timeout exceeded');
            }
        });

        it('should switch database when database option is provided', async () => {
            getArrayItemStub.resolves([]);
            mockConnection.query.resolves([[{ id: 1 }]]);

            await dbConnector.getCacheQueryWithTimeout(
                'SELECT * FROM users',
                [],
                'users-cache',
                { database: 'analytics_db', timeout: 5000 }
            );

            expect(mockConnection.query.firstCall.args[0]).to.include('USE `analytics_db`');
        });
    });

    describe('closeConnections', () => {
        it('should close the connection pool', async () => {
            await dbConnector.closeConnections();

            expect(mockPool.end.called).to.be.true;
        });

        it('should prevent new queries after shutdown', async () => {
            await dbConnector.closeConnections();

            try {
                await dbConnector.QuaryCache('SELECT 1', [], null);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.include('Server is shutting down');
            }
        });
    });

    describe('getPoolStats', () => {
        it('should return pool statistics', () => {
            const stats = dbConnector.getPoolStats();

            expect(stats).to.have.property('totalConnections');
            expect(stats).to.have.property('activeConnections');
            expect(stats).to.have.property('freeConnections');
            expect(stats).to.have.property('queuedRequests');

            expect(stats.totalConnections).to.equal(5);
            expect(stats.freeConnections).to.equal(3);
            expect(stats.activeConnections).to.equal(2); // total - free
            expect(stats.queuedRequests).to.equal(0);
        });
    });

    describe('Automatic Reconnection', () => {
        it('should retry on PROTOCOL_CONNECTION_LOST error', async function() {
            this.timeout(10000);

            const error = new Error('Connection lost');
            error.code = 'PROTOCOL_CONNECTION_LOST';

            mockConnection.query
                .onFirstCall().rejects(error)
                .onSecondCall().resolves([[{ id: 1 }]]);

            const result = await dbConnector.QuaryCache('SELECT 1', [], null);

            expect(mockConnection.query.callCount).to.equal(2);
            expect(result).to.deep.equal([{ id: 1 }]);
        });

        it('should use exponential backoff for retries', async function() {
            this.timeout(10000);

            const error = new Error('Connection refused');
            error.code = 'ECONNREFUSED';

            mockConnection.query
                .onCall(0).rejects(error)
                .onCall(1).rejects(error)
                .onCall(2).resolves([[{ id: 1 }]]);

            const startTime = Date.now();
            await dbConnector.QuaryCache('SELECT 1', [], null);
            const endTime = Date.now();

            // Should have delays: 1000ms + 2000ms = at least 3000ms
            expect(endTime - startTime).to.be.at.least(2900);
            expect(mockConnection.query.callCount).to.equal(3);
        });
    });

    describe('Shutdown Protection', () => {
        it('should reject queries when isShuttingDown flag is set', async () => {
            await dbConnector.closeConnections();

            try {
                await dbConnector.getCacheQuery('SELECT 1', [], 'test-cache');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.include('Server is shutting down');
            }
        });
    });
});
