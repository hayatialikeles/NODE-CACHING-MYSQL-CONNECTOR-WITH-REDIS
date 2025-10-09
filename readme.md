Sure — here’s the full **English translation** of your MySQL Redis Cache Connector README, preserving tone, formatting, and style exactly as in the original:

---

# MySQL Redis Cache Connector

[![npm version](https://img.shields.io/npm/v/node-caching-mysql-connector-with-redis.svg)](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)
[![Test Coverage](https://img.shields.io/badge/coverage-98.07%25-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![Tests](https://img.shields.io/badge/tests-215%20passing-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![TypeScript](https://img.shields.io/badge/TypeScript-Full%20Support-blue.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

Production-ready MySQL connector with **automatic Redis caching**, **smart cache invalidation**, and **transaction support**.

**📚 Read in other languages:** [Türkçe](README.tr.md) 

---

## ✨ Why This Package?

```javascript
// ❌ Traditional approach – Manual cache management
const cachedUsers = await redis.get('users-active');
if (!cachedUsers) {
    const users = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
    await redis.set('users-active', JSON.stringify(users), 3600);
}
// Don’t forget to clear cache when updating!
await db.query('UPDATE users SET status = ? WHERE id = ?', ['inactive', 123]);
await redis.del('users-active'); // Very easy to forget!

// ✅ With this package – Zero configuration
const users = await getCacheQuery('SELECT * FROM users WHERE status = ?', ['active']);
await QuaryCache('UPDATE users SET status = ? WHERE id = ?', ['inactive', 123]);
// Cache automatically invalidated! ✨
```

---

## 🚀 Quick Start

### Installation

```bash
npm install node-caching-mysql-connector-with-redis
```

### Basic Setup

```javascript
// .env
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb
REDIS_SERVER=localhost
REDIS_PORT=6379
CORE_AUTO_FEATURES=true  // Enable smart features 🎯
```

```javascript
const { getCacheQuery, QuaryCache, withTransaction } = require('node-caching-mysql-connector-with-redis');

// Auto-cache read
const users = await getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);

// Auto-cache invalidation on write
await QuaryCache('INSERT INTO users (name, email) VALUES (?, ?)', ['Ahmet', 'ahmet@example.com']);

// Auto rollback transaction
await withTransaction(async (tx) => {
    await tx.query('INSERT INTO users...', [data]);
    await tx.query('INSERT INTO orders...', [order]);
    // ✅ Automatically commits on success
    // ⚠️ Automatically rolls back on failure
});
```

**That’s it!**
No manual cache keys, no manual invalidation, no manual transaction handling.

---

## 📖 Core Features

### 🎯 Smart Auto Features (v2.6.0)

| Feature                | Before                                          | After                                  |
| ---------------------- | ----------------------------------------------- | -------------------------------------- |
| **Cache Keys**         | `getCacheQuery(sql, params, 'user-123-active')` | `getCacheQuery(sql, params)` ✨         |
| **Cache Invalidation** | `QuaryCache(sql, params, 'users_*')`            | `QuaryCache(sql, params)` ✨            |
| **Transactions**       | Manual BEGIN/COMMIT/ROLLBACK                    | `withTransaction(async tx => {...})` ✨ |

### ⚡ Production-Grade Features

* ✅ **Auto Reconnection** – Exponential backoff on connection errors
* ✅ **Bulk Operations** – Automatic chunking for 100K+ records
* ✅ **Timeout Protection** – Prevents long-running query blocking
* ✅ **Connection Pool Management** – Monitor and optimize pool usage
* ✅ **Graceful Shutdown** – Clean disconnection on app exit
* ✅ **TypeScript Support** – Full IntelliSense and typings
* ✅ **100% Backward Compatible** – No breaking changes

---

## 💡 Common Use Cases

### E-Commerce Order Creation

```javascript
app.post('/orders', async (req, res) => {
    const { userId, items } = req.body;

    const orderId = await withTransaction(async (tx) => {
        const orderResult = await tx.query(
            'INSERT INTO orders (user_id, status) VALUES (?, ?)',
            [userId, 'pending']
        );

        for (const item of items) {
            await tx.query(
                'INSERT INTO order_items (order_id, product_id, quantity) VALUES (?, ?, ?)',
                [orderResult.insertId, item.productId, item.quantity]
            );

            await tx.query(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.productId]
            );
        }

        return orderResult.insertId;
        // ✅ Commits automatically on success
        // ⚠️ Rolls back automatically on error (stock remains consistent)
    });

    res.json({ orderId });
});
```

### Social Media Feed (Auto-Cache)

```javascript
// Fetch user feed (auto-cached)
app.get('/feed/:userId', async (req, res) => {
    const posts = await getCacheQuery(
        `SELECT p.*, u.name, u.avatar
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ?)
         ORDER BY p.created_at DESC LIMIT 20`,
        [req.params.userId]
    );
    res.json(posts);
});

// Create post (auto cache invalidation)
app.post('/posts', async (req, res) => {
    await QuaryCache(
        'INSERT INTO posts (user_id, content) VALUES (?, ?)',
        [req.body.userId, req.body.content]
    );
    res.json({ success: true });
});
```

### Bulk Data Import

```javascript
const { bulkInsert } = require('node-caching-mysql-connector-with-redis');

const result = await bulkInsert('analytics_events', millionEvents, {
    chunkSize: 1000,
    resetCacheName: 'analytics_*'
});
// { insertedRows: 1000000, chunks: 1000 }
```

### Multi-Tenant SaaS App

```javascript
app.get('/tenant/:id/users', async (req, res) => {
    const tenantDb = `tenant_${req.params.id}`;

    const users = await getCacheQuery(
        'SELECT * FROM users WHERE status = ?',
        ['active'],
        null,
        tenantDb
    );

    res.json(users);
});
```

### Real-Time Chat

```javascript
app.get('/chat/:roomId/messages', async (req, res) => {
    const messages = await getCacheQuery(
        `SELECT m.*, u.name, u.avatar
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.room_id = ?
         ORDER BY m.created_at DESC
         LIMIT 100`,
        [req.params.roomId]
    );
    res.json(messages);
});

app.post('/chat/:roomId/messages', async (req, res) => {
    await QuaryCache(
        'INSERT INTO messages (room_id, user_id, text) VALUES (?, ?, ?)',
        [req.params.roomId, req.body.userId, req.body.text]
    );
    res.json({ success: true });
});
```

📚 **[More Examples →](EXAMPLES.md)**

---

## 📦 API Quick Reference

```javascript
// Core functions
getCacheQuery(sql, parameters, cacheName?, database?)
QuaryCache(sql, parameters, resetCacheName?, database?)
withTransaction(callback, options?)

// Production utilities
bulkInsert(table, records, options?)
getCacheQueryWithTimeout(sql, parameters, cacheName, options?)
getCacheQueryPagination(sql, parameters, cacheName, page, pageSize?, database?)
closeConnections()
getPoolStats()

// Redis operations
getArrayItem(key)
addArrayItem(key, data, expiry?)
delKeyItem(keys)
delPrefixKeyItem(patterns)

// Configuration
configure({ autoKey, autoInvalidation })
enableAutoKey(config?)
enableAutoInvalidation(config?)
```

📚 **[Full API Documentation →](API.md)**

---

## ⚙️ Configuration

### Required Environment Variables

```bash
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb

REDIS_SERVER=localhost
REDIS_PORT=6379
```

### Optional Smart Features

```bash
CORE_AUTO_FEATURES=true
```

### Advanced Settings

```bash
DB_PORT=3306
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_CONNECT_TIMEOUT=10000
TIMEZONE=+00:00

REDIS_PASSWORD=secret
REDIS_VHOST=my_namespace
REDIS_ENABLED=true

DB_MULTIPLE_STATEMENTS=false
```

### Programmatic Configuration

```javascript
const { configure } = require('node-caching-mysql-connector-with-redis');

configure({
    autoKey: { enabled: true },
    autoInvalidation: {
        enabled: true,
        tables: {
            users: ['users_*', 'profiles_*', 'sessions_*'],
            orders: ['orders_*', 'cart_*', 'analytics_*'],
            products: ['products_*', 'catalog_*']
        }
    }
});
```

📚 **[Full Configuration Guide →](CONFIGURATION.md)**

---

## 🔄 Migration & Compatibility

### ✅ 100% Backward Compatible

Your existing code works out of the box:

```javascript
await getCacheQuery('SELECT * FROM users', [], 'my-custom-key');
await QuaryCache('INSERT INTO users...', [data], 'users_*');
```

### Gradual Adoption

```javascript
CORE_AUTO_FEATURES=true

await getCacheQuery('SELECT * FROM users', []); // Auto key ✨
await getCacheQuery('SELECT * FROM orders', [], 'orders-all'); // Manual key still valid
```

### Migration from Manual Cache

```javascript
// ❌ Before
const cachedData = await redis.get('users-active');
if (!cachedData) {
    const data = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
    await redis.set('users-active', JSON.stringify(data), 3600);
    return data;
}
return JSON.parse(cachedData);

// ✅ After
const data = await getCacheQuery('SELECT * FROM users WHERE status = ?', ['active']);
```

📚 **[Migration Guide →](MIGRATION.md)**

---

## 🧪 Testing

```bash
npm test
npm run coverage
```

**Coverage:** 98.07% | **Tests:** 215 passing ✅

---

## 📝 TypeScript Support

```typescript
import { getCacheQuery, withTransaction, TransactionContext } from 'node-caching-mysql-connector-with-redis';

interface User {
    id: number;
    name: string;
    email: string;
}

const users = await getCacheQuery<User>('SELECT * FROM users WHERE id = ?', [123]);

await withTransaction(async (tx: TransactionContext) => {
    const result = await tx.query<{insertId: number}>('INSERT INTO users...', [data]);
    return result.insertId;
});
```

---

## ⚠️ Important Notes

### Cache Strategy

* Ideal for **read-heavy workloads**
* Default TTL: 40,000 seconds (~11 hours)
* Disable Redis: `REDIS_ENABLED=false`

### Transactions

* `getCacheQuery` inside a transaction reads from cache but doesn’t enforce isolation
* Use `tx.query()` for critical reads
* Cache invalidation applied automatically after commit

### Production Best Practices

```javascript
process.on('SIGTERM', async () => {
    await closeConnections();
    process.exit(0);
});

setInterval(() => {
    const stats = getPoolStats();
    console.log(`Pool: ${stats.activeConnections}/${stats.totalConnections}`);
}, 60000);
```

---

## 🤝 Contributing

Contributions are welcome! Check [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 📄 License

MIT © [Ali Hayati Keleş](https://github.com/hayatialikeles)

---

## 🔗 Links

* [npm Package](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)
* [GitHub Repository](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
* [Report Issue](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS/issues)
* [Changelog](../CHANGELOG.md)

---

**Built with ❤️ for the Node.js community**

