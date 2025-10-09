# MySQL Redis Cache Connector

[![npm version](https://img.shields.io/npm/v/node-caching-mysql-connector-with-redis.svg)](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)
[![Test Coverage](https://img.shields.io/badge/coverage-98.07%25-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![Tests](https://img.shields.io/badge/tests-215%20passing-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![TypeScript](https://img.shields.io/badge/TypeScript-Full%20Support-blue.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

Otomatik Redis önbellekleme, akıllı cache temizleme ve transaction desteği ile production-ready MySQL bağlantı paketi.

**📚 Diğer dillerde oku:** [English](../README.md) | [Deutsch](README.de.md) | [Español](README.es.md)

---

## ✨ Neden Bu Paket?

```javascript
// ❌ Geleneksel yaklaşım - Manuel cache yönetimi
const cachedUsers = await redis.get('users-active');
if (!cachedUsers) {
    const users = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
    await redis.set('users-active', JSON.stringify(users), 3600);
}
// Güncelleme yaparken cache'i temizlemeyi unutmayın!
await db.query('UPDATE users SET status = ? WHERE id = ?', ['inactive', 123]);
await redis.del('users-active'); // Unutulması çok kolay!

// ✅ Bu paket ile - Sıfır konfigürasyon
const users = await getCacheQuery('SELECT * FROM users WHERE status = ?', ['active']);
await QuaryCache('UPDATE users SET status = ? WHERE id = ?', ['inactive', 123]);
// Cache otomatik temizlendi! ✨
```

---

## 🚀 Hızlı Başlangıç

### Kurulum

```bash
npm install node-caching-mysql-connector-with-redis
```

### Temel Kurulum

```javascript
// .env
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb
REDIS_SERVER=localhost
REDIS_PORT=6379
CORE_AUTO_FEATURES=true  // Akıllı özellikleri aktif et 🎯
```

```javascript
const { getCacheQuery, QuaryCache, withTransaction } = require('node-caching-mysql-connector-with-redis');

// Otomatik cache ile okuma
const users = await getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);

// Otomatik cache temizleme ile yazma
await QuaryCache('INSERT INTO users (name, email) VALUES (?, ?)', ['Ahmet', 'ahmet@example.com']);

// Otomatik rollback ile transaction
await withTransaction(async (tx) => {
    await tx.query('INSERT INTO users...', [data]);
    await tx.query('INSERT INTO orders...', [order]);
    // Başarılı olursa otomatik commit ✅
    // Hata olursa otomatik rollback ⚠️
});
```

**Bu kadar!** Manuel cache key'leri, manuel temizleme, manuel transaction yönetimi yok.

---

## 📖 Temel Özellikler

### 🎯 Akıllı Otomatik Özellikler (v2.6.0)

| Özellik | Önce | Sonra |
|---------|------|-------|
| **Cache Key'leri** | `getCacheQuery(sql, params, 'user-123-active')` | `getCacheQuery(sql, params)` ✨ |
| **Cache Temizleme** | `QuaryCache(sql, params, 'users_*')` | `QuaryCache(sql, params)` ✨ |
| **Transaction'lar** | Manuel BEGIN/COMMIT/ROLLBACK | `withTransaction(async tx => {...})` ✨ |

### ⚡ Production Özellikleri

- ✅ **Otomatik Yeniden Bağlanma** - Bağlantı hatalarında exponential backoff
- ✅ **Toplu İşlemler** - 100K+ kayıt için otomatik chunking
- ✅ **Timeout Koruması** - Uzun sorguları engelleyerek bloklamayı önleme
- ✅ **Connection Pool Yönetimi** - Pool kullanımını izleme ve optimize etme
- ✅ **Graceful Shutdown** - Uygulama kapanışında temiz bağlantı kapatma
- ✅ **TypeScript Desteği** - IntelliSense ile tam tip tanımlamaları
- ✅ **%100 Geriye Dönük Uyumlu** - Breaking change olmadan güncelleme

---

## 💡 Yaygın Kullanım Senaryoları

### E-Ticaret Sipariş Oluşturma

```javascript
app.post('/orders', async (req, res) => {
    const { userId, items } = req.body;

    const orderId = await withTransaction(async (tx) => {
        // Sipariş oluştur
        const orderResult = await tx.query(
            'INSERT INTO orders (user_id, status) VALUES (?, ?)',
            [userId, 'pending']
        );

        // Ürünleri ekle ve stok güncelle
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
        // ✅ Başarılı olursa otomatik commit
        // ⚠️ Hata olursa otomatik rollback (stok korunur!)
    });

    res.json({ orderId });
});
```

### Sosyal Medya Akışı (Auto-Cache)

```javascript
// Kullanıcı akışını getir (otomatik cache'lenir)
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

// Gönderi oluştur (akış cache'i otomatik temizlenir)
app.post('/posts', async (req, res) => {
    await QuaryCache(
        'INSERT INTO posts (user_id, content) VALUES (?, ?)',
        [req.body.userId, req.body.content]
    );
    // ✅ Takipçilerin akış cache'i otomatik temizlendi
    res.json({ success: true });
});
```

### Toplu Veri İçe Aktarma

```javascript
const { bulkInsert } = require('node-caching-mysql-connector-with-redis');

// 1 milyon kayıt içe aktar
const result = await bulkInsert('analytics_events', millionEvents, {
    chunkSize: 1000,  // Her seferinde 1000 kayıt işle
    resetCacheName: 'analytics_*'
});
// { insertedRows: 1000000, chunks: 1000 }
```

### Multi-Tenant SaaS Uygulaması

```javascript
// Tenant veritabanı değiştirme
app.get('/tenant/:id/users', async (req, res) => {
    const tenantDb = `tenant_${req.params.id}`;

    const users = await getCacheQuery(
        'SELECT * FROM users WHERE status = ?',
        ['active'],
        null,  // Otomatik cache key
        tenantDb  // Tenant veritabanına geç
    );

    res.json(users);
});
```

### Gerçek Zamanlı Sohbet

```javascript
// Sohbet geçmişi (cache'lenir)
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

// Mesaj gönder (oda cache'i otomatik temizlenir)
app.post('/chat/:roomId/messages', async (req, res) => {
    await QuaryCache(
        'INSERT INTO messages (room_id, user_id, text) VALUES (?, ?, ?)',
        [req.params.roomId, req.body.userId, req.body.text]
    );
    res.json({ success: true });
});
```

📚 **[Daha Fazla Örnek →](EXAMPLES.md)**

---

## 📦 API Hızlı Referans

```javascript
// Temel fonksiyonlar
getCacheQuery(sql, parameters, cacheName?, database?)
QuaryCache(sql, parameters, resetCacheName?, database?)
withTransaction(callback, options?)

// Production özellikleri
bulkInsert(table, records, options?)
getCacheQueryWithTimeout(sql, parameters, cacheName, options?)
getCacheQueryPagination(sql, parameters, cacheName, page, pageSize?, database?)
closeConnections()
getPoolStats()

// Redis operasyonları
getArrayItem(key)
addArrayItem(key, data, expiry?)
delKeyItem(keys)
delPrefixKeyItem(patterns)

// Konfigürasyon
configure({ autoKey, autoInvalidation })
enableAutoKey(config?)
enableAutoInvalidation(config?)
```

📚 **[Tam API Dokümantasyonu →](API.md)**

---

## ⚙️ Konfigürasyon

### Zorunlu Ortam Değişkenleri

```bash
# Veritabanı
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb

# Redis
REDIS_SERVER=localhost
REDIS_PORT=6379
```

### Opsiyonel Akıllı Özellikler

```bash
# Tüm akıllı özellikleri aktif et (önerilen)
CORE_AUTO_FEATURES=true
```

### Gelişmiş Ayarlar

```bash
# Veritabanı
DB_PORT=3306
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_CONNECT_TIMEOUT=10000
TIMEZONE=+00:00

# Redis
REDIS_PASSWORD=secret
REDIS_VHOST=my_namespace
REDIS_ENABLED=true

# Özel ayarlar
DB_MULTIPLE_STATEMENTS=false
```

### Programatik Konfigürasyon

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

📚 **[Tam Konfigürasyon Kılavuzu →](CONFIGURATION.md)**

---

## 🔄 Migration ve Uyumluluk

### ✅ %100 Geriye Dönük Uyumlu

Mevcut kodunuz hiçbir değişiklik olmadan çalışır:

```javascript
// ✅ Eski kod hala mükemmel çalışır
await getCacheQuery('SELECT * FROM users', [], 'my-custom-key');
await QuaryCache('INSERT INTO users...', [data], 'users_*');
```

### Kademeli Geçiş

```javascript
// Adım 1: .env dosyasına ekle
CORE_AUTO_FEATURES=true

// Adım 2: Yeni kod otomatik özellikleri kullanır
await getCacheQuery('SELECT * FROM users', []); // Otomatik key ✨

// Adım 3: Eski kod çalışmaya devam eder
await getCacheQuery('SELECT * FROM orders', [], 'orders-all'); // Manuel key hala çalışır
```

### Manuel Cache Yönetiminden Geçiş

```javascript
// ❌ Önce
const cachedData = await redis.get('users-active');
if (!cachedData) {
    const data = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
    await redis.set('users-active', JSON.stringify(data), 3600);
    return data;
}
return JSON.parse(cachedData);

// ✅ Sonra
const data = await getCacheQuery('SELECT * FROM users WHERE status = ?', ['active']);
```

📚 **[Migration Kılavuzu →](MIGRATION.md)**

---

## 🧪 Test

```bash
npm test              # Tüm testleri çalıştır
npm run coverage      # Coverage raporu ile çalıştır
```

**Test Coverage:** %98.07 | **Testler:** 215 başarılı

---

## 📝 TypeScript Desteği

IntelliSense ile tam TypeScript tanımlamaları:

```typescript
import { getCacheQuery, withTransaction, TransactionContext } from 'node-caching-mysql-connector-with-redis';

interface User {
    id: number;
    name: string;
    email: string;
}

// Tip-güvenli sorgular
const users = await getCacheQuery<User>('SELECT * FROM users WHERE id = ?', [123]);

// Tip-güvenli transaction'lar
await withTransaction(async (tx: TransactionContext) => {
    const result = await tx.query<{insertId: number}>('INSERT INTO users...', [data]);
    return result.insertId;
});
```

---

## ⚠️ Önemli Notlar

### Cache Stratejisi

- **Okuma ağırlıklı işlemler** için idealdir
- Default TTL: 40000 saniye (~11 saat)
- Redis devre dışı bırakılabilir: `REDIS_ENABLED=false`

### Transaction Kullanımı

- Transaction içindeki `getCacheQuery` cache'ten okur ama transaction izolasyonunu garanti etmez
- Kritik okumalar için `tx.query()` kullanın
- Transaction commit olduğunda cache invalidation uygulanır

### Production Best Practices

```javascript
// Graceful shutdown
process.on('SIGTERM', async () => {
    await closeConnections();
    process.exit(0);
});

// Connection pool monitoring
setInterval(() => {
    const stats = getPoolStats();
    console.log(`Pool: ${stats.activeConnections}/${stats.totalConnections}`);
}, 60000);
```

---

## 🤝 Katkıda Bulunma

Katkılarınız memnuniyetle karşılanır! [CONTRIBUTING.md](../CONTRIBUTING.md) dosyasına bakın.

---

## 📄 Lisans

MIT © [Ali Hayati Keleş](https://github.com/hayatialikeles)

---

## 🔗 Bağlantılar

- [npm Paketi](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)
- [GitHub Repository](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
- [Sorun Bildir](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS/issues)
- [Değişiklik Günlüğü](../CHANGELOG.md)

---

**Node.js topluluğu için ❤️ ile yapıldı**
