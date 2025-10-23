const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('redis.Connector', () => {
    let redisConnector;
    let mockRedisClient;
    let existsStub;
    let getStub;
    let setexStub;
    let delStub;
    let keysStub;

    beforeEach(() => {
        // Create stubs for Redis client methods
        existsStub = sinon.stub();
        getStub = sinon.stub();
        setexStub = sinon.stub();
        delStub = sinon.stub();
        keysStub = sinon.stub();

        mockRedisClient = {
            exists: sinon.stub().callsFake((key, callback) => callback(null, existsStub(key))),
            get: sinon.stub().callsFake((key, callback) => callback(null, getStub(key))),
            setex: sinon.stub().callsFake((key, ttl, value, callback) => callback(null, setexStub(key, ttl, value))),
            del: sinon.stub().callsFake((keys, callback) => callback(null, delStub(keys))),
            keys: sinon.stub().callsFake((pattern, callback) => callback(null, keysStub(pattern))),
            on: sinon.stub()
        };

        // Mock redis module
        const mockRedis = {
            createClient: sinon.stub().returns(mockRedisClient)
        };

        // Mock environment
        process.env.REDIS_SERVER = 'localhost';
        process.env.REDIS_PORT = '6379';
        process.env.REDIS_VHOST = 'testapp';

        // Load module with mocks
        redisConnector = proxyquire('../redis.Connector', {
            'redis': mockRedis
        });
    });

    afterEach(() => {
        sinon.restore();
        delete process.env.REDIS_SERVER;
        delete process.env.REDIS_PORT;
        delete process.env.REDIS_VHOST;
        delete process.env.REDIS_PASSWORD;
    });

    describe('getArrayItem', () => {
        it('should return parsed data if key exists', async () => {
            const testData = [{ id: 1, name: 'Test' }];
            existsStub.returns(1);
            getStub.returns(JSON.stringify(testData));

            const result = await redisConnector.getArrayItem('test-key');

            expect(result).to.deep.equal(testData);
            expect(mockRedisClient.exists.calledWith('testapp:test-key')).to.be.true;
        });

        it('should return empty array if key does not exist', async () => {
            existsStub.returns(0);

            const result = await redisConnector.getArrayItem('nonexistent-key');

            expect(result).to.deep.equal([]);
            expect(mockRedisClient.get.called).to.be.false;
        });

        it('should use namespace from REDIS_VHOST', async () => {
            existsStub.returns(0);

            await redisConnector.getArrayItem('my-key');

            expect(mockRedisClient.exists.calledWith('testapp:my-key')).to.be.true;
        });

        it('should work without namespace if REDIS_VHOST is not set', async () => {
            delete process.env.REDIS_VHOST;

            redisConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(mockRedisClient) }
            });

            existsStub.returns(0);
            await redisConnector.getArrayItem('my-key');

            expect(mockRedisClient.exists.calledWith('my-key')).to.be.true;
        });
    });

    describe('addArrayItem', () => {
        it('should store data with default expiry', async () => {
            const testData = [{ id: 1, name: 'Test' }];
            setexStub.returns('OK');

            const result = await redisConnector.addArrayItem('test-key', testData);

            expect(result).to.deep.equal(testData);
            expect(mockRedisClient.setex.calledWith(
                'testapp:test-key',
                40000,
                JSON.stringify(testData)
            )).to.be.true;
        });

        it('should store data with custom expiry', async () => {
            const testData = [{ id: 1 }];
            setexStub.returns('OK');

            await redisConnector.addArrayItem('test-key', testData, 3600);

            expect(mockRedisClient.setex.calledWith(
                'testapp:test-key',
                3600,
                JSON.stringify(testData)
            )).to.be.true;
        });

        it('should serialize complex objects', async () => {
            const complexData = [
                { id: 1, nested: { value: 'test' }, array: [1, 2, 3] }
            ];
            setexStub.returns('OK');

            await redisConnector.addArrayItem('complex-key', complexData);

            const expectedJSON = JSON.stringify(complexData);
            expect(mockRedisClient.setex.args[0][2]).to.equal(expectedJSON);
        });
    });

    describe('delKeyItem', () => {
        it('should delete a single key', async () => {
            delStub.returns(1);

            await redisConnector.delKeyItem('test-key');

            expect(mockRedisClient.del.calledWith('testapp:test-key')).to.be.true;
        });

        it('should delete multiple keys', async () => {
            delStub.returns(3);

            await redisConnector.delKeyItem(['key1', 'key2', 'key3']);

            expect(mockRedisClient.del.calledWith(['testapp:key1', 'testapp:key2', 'testapp:key3'])).to.be.true;
        });
    });

    describe('delPrefixKeyItem', () => {
        it('should delete all keys matching a prefix', async () => {
            const matchingKeys = [
                'testapp:users-1',
                'testapp:users-2',
                'testapp:users-3'
            ];
            keysStub.returns(matchingKeys);
            delStub.returns(3);

            await redisConnector.delPrefixKeyItem('users-');

            expect(mockRedisClient.keys.calledWith('testapp:users-*')).to.be.true;
            expect(delStub.callCount).to.equal(3);
        });

        it('should handle empty results gracefully', async () => {
            keysStub.returns([]);

            await redisConnector.delPrefixKeyItem('nonexistent-');

            expect(delStub.called).to.be.false;
        });

        it('should handle empty results gracefully for single key (not array)', async () => {
            keysStub.returns([]);

            await redisConnector.delPrefixKeyItem('single-nonexistent-');

            expect(delStub.called).to.be.false;
            expect(mockRedisClient.keys.calledOnce).to.be.true;
        });

        it('should delete keys for multiple prefixes', async () => {
            keysStub.onFirstCall().returns(['testapp:users-1']);
            keysStub.onSecondCall().returns(['testapp:products-1', 'testapp:products-2']);
            delStub.returns(1);

            await redisConnector.delPrefixKeyItem(['users-', 'products-']);

            expect(mockRedisClient.keys.firstCall.calledWith('testapp:users-*')).to.be.true;
            expect(mockRedisClient.keys.secondCall.calledWith('testapp:products-*')).to.be.true;
            expect(delStub.callCount).to.equal(3);
        });

        it('should use Promise.all for parallel deletion', async () => {
            const keys = ['testapp:cache-1', 'testapp:cache-2', 'testapp:cache-3'];
            keysStub.returns(keys);

            await redisConnector.delPrefixKeyItem('cache-');

            expect(delStub.callCount).to.equal(3);
        });
    });

    describe('getRedisClient', () => {
        it('should return the Redis client instance', () => {
            const client = redisConnector.getRedisClient();

            expect(client).to.equal(mockRedisClient);
        });
    });

    describe('Namespace handling', () => {
        it('should prefix all keys with REDIS_VHOST when set', async () => {
            process.env.REDIS_VHOST = 'myapp';

            redisConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(mockRedisClient) }
            });

            existsStub.returns(0);
            await redisConnector.getArrayItem('test');

            expect(mockRedisClient.exists.calledWith('myapp:test')).to.be.true;
        });

        it('should not prefix keys when REDIS_VHOST is not set', async () => {
            delete process.env.REDIS_VHOST;

            redisConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(mockRedisClient) }
            });

            existsStub.returns(0);
            await redisConnector.getArrayItem('test');

            expect(mockRedisClient.exists.calledWith('test')).to.be.true;
        });
    });

    describe('Error handling', () => {
        it('should propagate errors from Redis', async () => {
            // Create a new mock that rejects immediately
            const errorClient = {
                exists: sinon.stub().callsFake((key, callback) => {
                    callback(new Error('Redis connection failed'), null);
                }),
                get: sinon.stub(),
                setex: sinon.stub(),
                del: sinon.stub(),
                keys: sinon.stub(),
                on: sinon.stub()
            };

            const errorConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(errorClient) }
            });

            try {
                await errorConnector.getArrayItem('test-key');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.equal('Redis connection failed');
            }
        });

        it('should handle JSON parse errors gracefully', async () => {
            existsStub.returns(1);
            getStub.returns('invalid-json{{{');

            try {
                await redisConnector.getArrayItem('test-key');
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err).to.be.instanceOf(Error);
            }
        });

        it('should handle Redis client error events', () => {
            const consoleErrorStub = sinon.stub(console, 'error');
            const consoleLogStub = sinon.stub(console, 'log');
            const testError = new Error('Redis connection lost');

            // Find the error event handler (first 'error' event registered)
            const errorEventCall = mockRedisClient.on.getCalls().find(call => call.args[0] === 'error');
            const errorHandler = errorEventCall.args[1];
            errorHandler(testError);

            // Updated: Now logs 'Redis Error:' prefix with error message
            expect(consoleErrorStub.calledWith('Redis Error:', testError.message)).to.be.true;
            consoleErrorStub.restore();
            consoleLogStub.restore();
        });
    });
});
