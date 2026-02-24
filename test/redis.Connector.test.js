const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

/**
 * Create a mock Redis v3 client with EventEmitter-like behavior.
 * Fires 'ready' synchronously so isRedisReady = true before tests run.
 */
function createMockClient(stubs) {
    const listeners = {};

    const client = {
        exists: sinon.stub().callsFake((key, callback) => callback(null, stubs.exists(key))),
        get: sinon.stub().callsFake((key, callback) => callback(null, stubs.get(key))),
        setex: sinon.stub().callsFake((key, ttl, value, callback) => callback(null, stubs.setex(key, ttl, value))),
        del: sinon.stub().callsFake((...args) => {
            const callback = args[args.length - 1];
            const keys = args.slice(0, -1);
            callback(null, stubs.del(keys.length === 1 ? keys[0] : keys));
        }),
        scan: sinon.stub().callsFake((cursor, ...args) => {
            const callback = args[args.length - 1];
            const result = stubs.scan(cursor, args);
            callback(null, result);
        }),
        on: sinon.stub().callsFake((event, handler) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
            if (event === 'ready') handler();
        }),
        once: sinon.stub().callsFake((event, handler) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        }),
        removeListener: sinon.stub().callsFake((event, handler) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(h => h !== handler);
            }
        }),
        setMaxListeners: sinon.stub(),
        _listeners: listeners
    };

    return client;
}

describe('redis.Connector', () => {
    let redisConnector;
    let mockRedisClient;
    let existsStub, getStub, setexStub, delStub, scanStub;

    beforeEach(() => {
        existsStub = sinon.stub();
        getStub = sinon.stub();
        setexStub = sinon.stub();
        delStub = sinon.stub();
        scanStub = sinon.stub();

        mockRedisClient = createMockClient({
            exists: existsStub,
            get: getStub,
            setex: setexStub,
            del: delStub,
            scan: scanStub
        });

        const mockRedis = {
            createClient: sinon.stub().returns(mockRedisClient)
        };

        process.env.REDIS_SERVER = 'localhost';
        process.env.REDIS_PORT = '6379';
        process.env.REDIS_VHOST = 'testapp';

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
        delete process.env.REDIS_WAIT_TIMEOUT;
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

        it('should return empty array on Redis failure (graceful degradation)', async () => {
            const errorClient = createMockClient({
                exists: existsStub, get: getStub, setex: setexStub,
                del: delStub, scan: scanStub
            });
            errorClient.exists = sinon.stub().callsFake((key, callback) => {
                callback(new Error('Redis connection failed'), null);
            });

            const errorConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(errorClient) }
            });

            const result = await errorConnector.getArrayItem('test-key');
            expect(result).to.deep.equal([]);
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

        it('should return data even on Redis failure (graceful degradation)', async () => {
            const errorClient = createMockClient({
                exists: existsStub, get: getStub, setex: sinon.stub(),
                del: delStub, scan: scanStub
            });
            errorClient.setex = sinon.stub().callsFake((k, t, v, callback) => {
                callback(new Error('Redis write failed'), null);
            });

            const errorConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(errorClient) }
            });

            const testData = [{ id: 1 }];
            const result = await errorConnector.addArrayItem('key', testData);
            expect(result).to.deep.equal(testData);
        });
    });

    describe('delKeyItem', () => {
        it('should delete a single key', async () => {
            delStub.returns(1);
            await redisConnector.delKeyItem('test-key');
            expect(mockRedisClient.del.calledOnce).to.be.true;
        });

        it('should delete multiple keys', async () => {
            delStub.returns(3);
            await redisConnector.delKeyItem(['key1', 'key2', 'key3']);
            expect(mockRedisClient.del.calledOnce).to.be.true;
        });
    });

    describe('delPrefixKeyItem', () => {
        it('should delete all keys matching a prefix using SCAN', async () => {
            scanStub.returns(['0', ['testapp:users-1', 'testapp:users-2', 'testapp:users-3']]);
            delStub.returns(1);

            await redisConnector.delPrefixKeyItem('users-');

            expect(mockRedisClient.scan.called).to.be.true;
            expect(mockRedisClient.del.callCount).to.equal(1);
        });

        it('should handle empty results gracefully', async () => {
            scanStub.returns(['0', []]);
            await redisConnector.delPrefixKeyItem('nonexistent-');
            expect(mockRedisClient.del.called).to.be.false;
        });

        it('should handle empty results gracefully for single key (not array)', async () => {
            scanStub.returns(['0', []]);
            await redisConnector.delPrefixKeyItem('single-nonexistent-');
            expect(mockRedisClient.del.called).to.be.false;
            expect(mockRedisClient.scan.called).to.be.true;
        });

        it('should delete keys for multiple prefixes', async () => {
            scanStub.onCall(0).returns(['0', ['testapp:users-1']]);
            scanStub.onCall(1).returns(['0', ['testapp:products-1', 'testapp:products-2']]);
            delStub.returns(1);

            await redisConnector.delPrefixKeyItem(['users-', 'products-']);

            expect(mockRedisClient.scan.callCount).to.equal(2);
            expect(mockRedisClient.del.callCount).to.equal(2);
        });

        it('should batch delete in chunks of 100', async () => {
            const keys = Array.from({ length: 250 }, (_, i) => `testapp:key-${i}`);
            scanStub.returns(['0', keys]);
            delStub.returns(1);

            await redisConnector.delPrefixKeyItem('key-');

            expect(mockRedisClient.del.callCount).to.equal(3);
        });

        it('should handle multiple SCAN iterations', async () => {
            scanStub.onCall(0).returns(['1', ['testapp:key-1', 'testapp:key-2']]);
            scanStub.onCall(1).returns(['0', ['testapp:key-3']]);
            delStub.returns(1);

            await redisConnector.delPrefixKeyItem('key-');

            expect(mockRedisClient.scan.callCount).to.equal(2);
            expect(mockRedisClient.del.callCount).to.equal(1);
        });
    });

    describe('getRedisClient', () => {
        it('should return the Redis client instance', () => {
            const client = redisConnector.getRedisClient();
            expect(client).to.equal(mockRedisClient);
        });
    });

    describe('isRedisConnected', () => {
        it('should return true when Redis is ready', () => {
            expect(redisConnector.isRedisConnected()).to.be.true;
        });

        it('should return false when Redis connection is lost', () => {
            const errorCall = mockRedisClient.on.getCalls().find(call => call.args[0] === 'error');
            errorCall.args[1](new Error('Connection lost'));
            expect(redisConnector.isRedisConnected()).to.be.false;
        });
    });

    describe('Namespace handling', () => {
        it('should prefix all keys with REDIS_VHOST when set', async () => {
            process.env.REDIS_VHOST = 'myapp';

            const client = createMockClient({
                exists: existsStub, get: getStub, setex: setexStub,
                del: delStub, scan: scanStub
            });

            redisConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(client) }
            });

            existsStub.returns(0);
            await redisConnector.getArrayItem('test');
            expect(client.exists.calledWith('myapp:test')).to.be.true;
        });

        it('should not prefix keys when REDIS_VHOST is not set', async () => {
            delete process.env.REDIS_VHOST;

            const client = createMockClient({
                exists: existsStub, get: getStub, setex: setexStub,
                del: delStub, scan: scanStub
            });

            redisConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(client) }
            });

            existsStub.returns(0);
            await redisConnector.getArrayItem('test');
            expect(client.exists.calledWith('test')).to.be.true;
        });
    });

    describe('Error handling', () => {
        it('should return graceful fallback for read errors', async () => {
            const errorClient = createMockClient({
                exists: existsStub, get: getStub, setex: setexStub,
                del: delStub, scan: scanStub
            });
            errorClient.exists = sinon.stub().callsFake((key, callback) => {
                callback(new Error('Redis connection failed'), null);
            });

            const errorConnector = proxyquire('../redis.Connector', {
                'redis': { createClient: sinon.stub().returns(errorClient) }
            });

            const result = await errorConnector.getArrayItem('test-key');
            expect(result).to.deep.equal([]);
        });

        it('should handle JSON parse errors with graceful fallback', async () => {
            existsStub.returns(1);
            getStub.returns('invalid-json{{{');

            const result = await redisConnector.getArrayItem('test-key');
            expect(result).to.deep.equal([]);
        });

        it('should handle Redis client error events', () => {
            const consoleErrorStub = sinon.stub(console, 'error');
            const consoleLogStub = sinon.stub(console, 'log');
            const testError = new Error('Redis connection lost');

            const errorEventCall = mockRedisClient.on.getCalls().find(call => call.args[0] === 'error');
            errorEventCall.args[1](testError);

            expect(consoleErrorStub.calledWith('Redis Error:', testError.message)).to.be.true;
            consoleErrorStub.restore();
            consoleLogStub.restore();
        });
    });

    describe('waitForConnection', () => {
        it('should resolve immediately when already connected', async () => {
            const start = Date.now();
            await redisConnector.getArrayItem('test');
            expect(Date.now() - start).to.be.lessThan(100);
        });

        it('should wait for ready event when disconnected', async () => {
            const endCall = mockRedisClient.on.getCalls().find(call => call.args[0] === 'end');
            endCall.args[1]();

            setTimeout(() => {
                const readyCall = mockRedisClient.on.getCalls().find(call => call.args[0] === 'ready');
                readyCall.args[1]();
                if (mockRedisClient._listeners['ready']) {
                    mockRedisClient._listeners['ready'].forEach(fn => fn());
                    mockRedisClient._listeners['ready'] = [];
                }
            }, 50);

            existsStub.returns(0);
            const result = await redisConnector.getArrayItem('test');
            expect(result).to.deep.equal([]);
        });
    });
});
