const redis = require('redis');
const { promisify } = require('util');
require('dotenv').config();

// Redis client configuration with reconnection strategy
const client = redis.createClient({
    host: process.env.REDIS_SERVER,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    retry_strategy: (options) => {
        // Connection refused - likely Redis is down
        if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis connection refused. Is Redis server running?');
            return new Error('Redis connection refused');
        }

        // Retry time exhausted (1 hour)
        if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted (1 hour)');
            return new Error('Redis retry time exhausted');
        }

        // Stop retrying after 10 attempts
        if (options.attempt > 10) {
            console.error('Redis max retry attempts reached (10)');
            return undefined;  // Stop retrying
        }

        // Exponential backoff: 100ms, 200ms, 400ms, ..., max 3000ms
        const delay = Math.min(options.attempt * 100, 3000);
        console.log(`Redis reconnecting in ${delay}ms (attempt ${options.attempt})`);
        return delay;
    }
});

// Redis bağlantı durumu
let isRedisReady = false;

// Connection event handlers
client.on('error', (err) => {
    isRedisReady = false;
    console.error('Redis Error:', err.message);
});

client.on('connect', () => {
    console.log('Redis connected');
});

client.on('ready', () => {
    isRedisReady = true;
    console.log('Redis ready');
});

client.on('reconnecting', (params) => {
    console.log(`Redis reconnecting... (attempt ${params.attempt}, delay ${params.delay}ms)`);
});

client.on('end', () => {
    isRedisReady = false;
    console.log('Redis connection closed');
});

const existsAsync = promisify(client.exists).bind(client);
const getAsync = promisify(client.get).bind(client);
const setexAsync = promisify(client.setex).bind(client);
const delAsync = promisify(client.del).bind(client);
const scanAsync = promisify(client.scan).bind(client);

// Bağlantı hazır olana kadar bekle
function waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (isRedisReady) {
            return resolve();
        }

        const timeoutId = setTimeout(() => {
            reject(new Error('Redis connection timeout'));
        }, timeout);

        const checkReady = () => {
            if (isRedisReady) {
                clearTimeout(timeoutId);
                resolve();
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    });
}

// SCAN ile key'leri bul (KEYS yerine - daha güvenli ve replica/cluster uyumlu)
async function scanKeys(pattern) {
    await waitForConnection();

    const keys = [];
    let cursor = '0';

    do {
        const [newCursor, foundKeys] = await scanAsync(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
}

function _namespaceKey(key) {
    return process.env.REDIS_VHOST ? `${process.env.REDIS_VHOST}:${key}` : key;
}

module.exports = {
    async getArrayItem(key) {
        const namespacedKey = _namespaceKey(key);
        const exists = await existsAsync(namespacedKey);
        if (exists) {
            const reply = await getAsync(namespacedKey);
            return JSON.parse(reply);
        }
        return [];
    },

    async addArrayItem(key, array, expiryDate = 40000) {
        const namespacedKey = _namespaceKey(key);
        await setexAsync(namespacedKey, expiryDate, JSON.stringify(array));
        return array;
    },

    async delKeyItem(keys) {
        if (Array.isArray(keys)) {
            const namespacedKeys = keys.map(key => _namespaceKey(key));
            await delAsync(namespacedKeys);
        } else {
            const namespacedKey = _namespaceKey(keys);
            await delAsync(namespacedKey);
        }
    },

    async delPrefixKeyItem(keys) {
        if (Array.isArray(keys)) {
            for (const el of keys) {
                const namespacedPattern = _namespaceKey(`${el}*`);
                const data = await scanKeys(namespacedPattern);
                if (data.length) {
                    await Promise.all(data.map(keyItem => delAsync(keyItem)));
                }
            }
        } else {
            const namespacedPattern = _namespaceKey(`${keys}*`);
            const data = await scanKeys(namespacedPattern);
            if (data.length) {
                await Promise.all(data.map(keyItem => delAsync(keyItem)));
            }
        }
    },

    getRedisClient() {
        return client;
    }
};