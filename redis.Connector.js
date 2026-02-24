const redis = require('redis');
const { promisify } = require('util');
require('dotenv').config();

// ── Configuration ──────────────────────────────────────────────
const RECONNECT_BASE_DELAY = 500;   // Initial retry delay (ms)
const RECONNECT_MAX_DELAY  = 30000; // Max delay between retries (30s)
const WAIT_TIMEOUT = parseInt(process.env.REDIS_WAIT_TIMEOUT, 10) || 10000;

// ── Redis Client ───────────────────────────────────────────────
const client = redis.createClient({
    host: process.env.REDIS_SERVER,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    // Unlimited retry — exponential backoff with jitter, never gives up
    retry_strategy: (options) => {
        const exp = Math.min(
            RECONNECT_BASE_DELAY * Math.pow(2, options.attempt - 1),
            RECONNECT_MAX_DELAY
        );
        const jitter = Math.floor(Math.random() * exp * 0.2);
        const delay = exp + jitter;
        console.log(`Redis reconnecting in ${delay}ms (attempt ${options.attempt})`);
        return delay;
    }
});

// Allow many concurrent waitForConnection() listeners without warning
client.setMaxListeners(0);

// ── Connection State ───────────────────────────────────────────
let isRedisReady = false;

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

// ── Promisified Commands ───────────────────────────────────────
const existsAsync = promisify(client.exists).bind(client);
const getAsync    = promisify(client.get).bind(client);
const setexAsync  = promisify(client.setex).bind(client);
const delAsync    = promisify(client.del).bind(client);
const scanAsync   = promisify(client.scan).bind(client);

// ── Connection Guard ───────────────────────────────────────────

/**
 * Wait for Redis connection to be ready.
 * Uses event listener (not polling) — no memory leak possible.
 * @param {number} [timeout] - Max wait time in ms (default: WAIT_TIMEOUT)
 */
function waitForConnection(timeout) {
    timeout = timeout || WAIT_TIMEOUT;

    if (isRedisReady) return Promise.resolve();

    return new Promise((resolve, reject) => {
        let settled = false;

        const onReady = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
        };

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            client.removeListener('ready', onReady);
            reject(new Error(`Redis connection timeout (${timeout}ms)`));
        }, timeout);

        client.once('ready', onReady);
    });
}

/**
 * Execute a Redis operation with connection guard + graceful fallback.
 * - Waits for connection before executing
 * - On failure returns fallback (reads) or logs warning (writes)
 *
 * @param {Function} fn        - Async function to execute
 * @param {*}        [fallback] - Value to return on failure (omit to throw)
 */
async function safeExec(fn, fallback) {
    const hasFallback = arguments.length > 1;
    try {
        await waitForConnection();
        return await fn();
    } catch (err) {
        console.error('Redis operation failed:', err.message);
        if (hasFallback) return fallback;
        throw err;
    }
}

// ── SCAN (replaces KEYS — production-safe, cluster-compatible) ─

async function scanKeys(pattern) {
    const keys = [];
    let cursor = '0';
    do {
        const [newCursor, foundKeys] = await scanAsync(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        keys.push(...foundKeys);
    } while (cursor !== '0');
    return keys;
}

// ── Helpers ────────────────────────────────────────────────────

function _namespaceKey(key) {
    return process.env.REDIS_VHOST ? `${process.env.REDIS_VHOST}:${key}` : key;
}

const DEL_BATCH_SIZE = 100;

// ── Public API ─────────────────────────────────────────────────

module.exports = {
    /**
     * Get cached array item. Returns [] on cache miss OR Redis failure.
     */
    async getArrayItem(key) {
        return safeExec(async () => {
            const namespacedKey = _namespaceKey(key);
            const exists = await existsAsync(namespacedKey);
            if (exists) {
                const reply = await getAsync(namespacedKey);
                return JSON.parse(reply);
            }
            return [];
        }, []);
    },

    /**
     * Store array item in cache. Returns the data even if caching fails.
     */
    async addArrayItem(key, array, expiryDate = 40000) {
        return safeExec(async () => {
            const namespacedKey = _namespaceKey(key);
            await setexAsync(namespacedKey, expiryDate, JSON.stringify(array));
            return array;
        }, array);
    },

    /**
     * Delete specific cache keys. Logs warning on failure (doesn't throw).
     */
    async delKeyItem(keys) {
        return safeExec(async () => {
            if (Array.isArray(keys)) {
                const namespacedKeys = keys.map(key => _namespaceKey(key));
                await delAsync(namespacedKeys);
            } else {
                const namespacedKey = _namespaceKey(keys);
                await delAsync(namespacedKey);
            }
        }, undefined);
    },

    /**
     * Delete cache keys by prefix pattern using SCAN. Logs warning on failure.
     */
    async delPrefixKeyItem(keys) {
        return safeExec(async () => {
            const prefixes = Array.isArray(keys) ? keys : [keys];
            for (const prefix of prefixes) {
                const namespacedPattern = _namespaceKey(`${prefix}*`);
                const data = await scanKeys(namespacedPattern);
                if (data.length) {
                    for (let i = 0; i < data.length; i += DEL_BATCH_SIZE) {
                        const batch = data.slice(i, i + DEL_BATCH_SIZE);
                        await delAsync(...batch);
                    }
                }
            }
        }, undefined);
    },

    /**
     * Check if Redis connection is healthy. Useful for health-check endpoints.
     */
    isRedisConnected() {
        return isRedisReady;
    },

    /**
     * Returns the raw Redis client instance.
     */
    getRedisClient() {
        return client;
    }
};
