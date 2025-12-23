# MySQL Redis Cache Connector

[![npm](https://img.shields.io/npm/v/node-caching-mysql-connector-with-redis.svg)](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)

MySQL + Redis caching. Zero config.

## Install

```bash
npm install node-caching-mysql-connector-with-redis
```

## Setup

```bash
# .env
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb
REDIS_SERVER=localhost
REDIS_PORT=6379
CORE_AUTO_FEATURES=true
```

## Usage

```javascript
const { getCacheQuery, QuaryCache, withTransaction } = require('node-caching-mysql-connector-with-redis');

// Read (auto-cached)
const users = await getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);

// Write (auto cache invalidation)
await QuaryCache('INSERT INTO users (name) VALUES (?)', ['Ali']);

// Transaction (auto commit/rollback)
await withTransaction(async (tx) => {
    await tx.query('INSERT INTO orders...', [data]);
    await tx.query('UPDATE products...', [data]);
});
```

## API

| Function | Description |
|----------|-------------|
| `getCacheQuery(sql, params)` | Cached read |
| `QuaryCache(sql, params)` | Write + invalidate cache |
| `withTransaction(fn)` | Auto commit/rollback |
| `getCacheQueryPagination(sql, params, key, page, size)` | Paginated query |
| `bulkInsert(table, records, options)` | Bulk insert |

## Config

```bash
# Required
DB_HOST, DB_USERNAME, DB_NAME, REDIS_SERVER

# Optional
DB_PASSWORD, DB_PORT=3306, REDIS_PORT=6379, REDIS_PASSWORD
DB_CONNECTION_LIMIT=151, REDIS_VHOST=namespace
CORE_AUTO_FEATURES=true, REDIS_ENABLED=true
```

## Use Cases

| Scenario | Guide |
|----------|-------|
| E-Commerce | [docs/USE-CASE-ECOMMERCE.md](docs/USE-CASE-ECOMMERCE.md) |
| Multi-Tenant SaaS | [docs/USE-CASE-SAAS.md](docs/USE-CASE-SAAS.md) |
| Real-Time Apps | [docs/USE-CASE-REALTIME.md](docs/USE-CASE-REALTIME.md) |
| Bulk Operations | [docs/USE-CASE-BULK.md](docs/USE-CASE-BULK.md) |

## Docs

- [API Reference](docs/API.md)
- [Configuration](docs/CONFIGURATION.md)
- [Examples](docs/EXAMPLES.md)
- [Migration Guide](docs/MIGRATION.md)
- [Türkçe](docs/README.tr.md)

## License

MIT
