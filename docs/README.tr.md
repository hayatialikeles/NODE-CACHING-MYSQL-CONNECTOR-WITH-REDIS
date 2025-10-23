# MySQL Redis Cache Connector

[![npm version](https://img.shields.io/npm/v/node-caching-mysql-connector-with-redis.svg)](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)
[![Test Coverage](https://img.shields.io/badge/coverage-98.07%25-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![Tests](https://img.shields.io/badge/tests-215%20passing-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![TypeScript](https://img.shields.io/badge/TypeScript-Full%20Support-blue.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

Üretim ortamına hazır, **otomatik Redis önbellekleme**, **akıllı cache temizleme** ve **transaction desteği** içeren MySQL connector paketi.

---

## ✨ Neden Bu Paket?

```javascript
// ❌ Geleneksel yöntem – Manuel cache yönetimi
const cachedUsers = await redis.get('users-active');
if (!cachedUsers) {
    const users = await db.query('SELECT * FROM users WHERE status = ?', ['active']);
    await redis.set('users-active', JSON.stringify(users), 3600);
}
// Güncellemede cache silmeyi unutmayın!
await db.query('UPDATE users SET status = ? WHERE id = ?', ['inactive', 123]);
await redis.del('users-active'); // Unutmak çok kolay!

// ✅ Bu paketle – Sıfır konfigürasyon
const users = await getCacheQuery('SELECT * FROM users WHERE status = ?', ['active']);
await QuaryCache('UPDATE users SET status = ? WHERE id = ?', ['inactive', 123]);
// Cache otomatik temizlenir! ✨
````

---

## 🚀 Hızlı Başlangıç

### Kurulum

```bash
npm install node-caching-mysql-connector-with-redis
```

### Temel Kullanım

```bash
# .env
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb
REDIS_SERVER=localhost
REDIS_PORT=6379
CORE_AUTO_FEATURES=true  # Akıllı özellikleri etkinleştir 🎯
```

```javascript
const { getCacheQuery, QuaryCache, withTransaction } = require('node-caching-mysql-connector-with-redis');

// Otomatik cache ile veri okuma
const users = await getCacheQuery('SELECT * FROM users WHERE id = ?', [123]);

// Yazma işlemlerinde otomatik cache temizleme
await QuaryCache('INSERT INTO users (name, email) VALUES (?, ?)', ['Ahmet', 'ahmet@example.com']);

// Transaction yönetimi (otomatik commit/rollback)
await withTransaction(async (tx) => {
    await tx.query('INSERT INTO users...', [data]);
    await tx.query('INSERT INTO orders...', [order]);
});
```

**Hepsi bu kadar!**
Manuel cache key, manuel invalidation veya transaction yönetimi gerekmez.

---

## 🧠 Akıllı Özellikler (v2.6.0)

| Özellik                | Önce                                     | Şimdi                            | Açıklama                      |
| ---------------------- | ---------------------------------------- | -------------------------------- | ----------------------------- |
| **Cache Key**          | `getCacheQuery(sql, params, 'user-123')` | `getCacheQuery(sql, params)` ✨   | Otomatik anahtar üretimi      |
| **Cache Invalidation** | `QuaryCache(sql, params, 'users_*')`     | `QuaryCache(sql, params)` ✨      | Otomatik cache temizleme      |
| **Transaction**        | Manuel BEGIN/COMMIT                      | `withTransaction(tx => {...})` ✨ | Otomatik transaction yönetimi |

---

## ⚡ Üretim Düzeyi Özellikler

* ✅ **Otomatik Yeniden Bağlantı** – Bağlantı hatalarında backoff ile tekrar deneme
* ✅ **Bulk İşlemler** – 100K+ kayıt için otomatik parçalara bölme
* ✅ **Timeout Koruması** – Uzun süren sorguların sistemi bloklamasını önler
* ✅ **Connection Pool İzleme** – Aktif bağlantı sayısı ve durum takibi
* ✅ **Graceful Shutdown** – Kapanışta temiz bağlantı kapatma
* ✅ **TypeScript Desteği** – Tam IntelliSense ve tip tanımları
* ✅ **%100 Geriye Dönük Uyumluluk** – Hiçbir breaking change yok

---

## 💡 Yaygın Kullanım Senaryoları

### 🛒 E-Ticaret Sipariş Oluşturma

```javascript
await withTransaction(async (tx) => {
    const order = await tx.query(
        'INSERT INTO orders (user_id, status) VALUES (?, ?)',
        [userId, 'pending']
    );

    for (const item of items) {
        await tx.query(
            'INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?)',
            [order.insertId, item.id, item.qty]
        );
        await tx.query(
            'UPDATE products SET stock = stock - ? WHERE id = ?',
            [item.qty, item.id]
        );
    }

    return order.insertId;
});
```

### 📱 Sosyal Medya Akışı (Auto Cache)

```javascript
// Otomatik cache ile feed çekme
const posts = await getCacheQuery(
  `SELECT p.*, u.name FROM posts p
   JOIN users u ON p.user_id = u.id
   WHERE p.user_id IN (SELECT following_id FROM followers WHERE follower_id = ?)
   ORDER BY p.created_at DESC LIMIT 20`,
  [userId]
);

// Yeni gönderi oluştur – cache otomatik temizlenir
await QuaryCache('INSERT INTO posts (user_id, content) VALUES (?, ?)', [userId, content]);
```

---

## 🧰 API Hızlı Referans

```javascript
// Ana fonksiyonlar
getCacheQuery(sql, params, cacheName?, database?)
QuaryCache(sql, params, resetCacheName?, database?)
withTransaction(callback, options?)

// Yardımcılar
bulkInsert(table, records, options?)
getCacheQueryWithTimeout(sql, params, cacheName, options?)
getCacheQueryPagination(sql, params, cacheName, page, pageSize?, database?)
closeConnections()
getPoolStats()

// Redis fonksiyonları
getArrayItem(key)
addArrayItem(key, data, expiry?)
delKeyItem(keys)
delPrefixKeyItem(patterns)
```

📚 **[Detaylı API Dokümantasyonu →](API.md)**

---

## ⚙️ Konfigürasyon

### Zorunlu Değişkenler

```bash
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=secret
DB_NAME=mydb

REDIS_SERVER=localhost
REDIS_PORT=6379
```

### Opsiyonel Akıllı Özellikler

```bash
CORE_AUTO_FEATURES=true
```

### Gelişmiş Ayarlar

```bash
DB_PORT=3306
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
DB_CONNECT_TIMEOUT=10000
TIMEZONE=+00:00
REDIS_PASSWORD=secret
REDIS_ENABLED=true
```

---

## 🔄 Geriye Dönük Uyumluluk

v2.5.3 kodunuz **hiçbir değişiklik olmadan** çalışmaya devam eder:

```javascript
await getCacheQuery('SELECT * FROM users', [], 'my-key');
await QuaryCache('INSERT INTO users...', [data], 'users_*');
```

Yeni sürümde `CORE_AUTO_FEATURES=true` yaparsanız:

```javascript
await getCacheQuery('SELECT * FROM users', []);  // Otomatik cache key ✨
await QuaryCache('INSERT INTO users...', [data]); // Otomatik invalidation ✨
```

---

## 🧪 Test

```bash
npm test
npm run coverage
```

**Kapsama:** %98.07 | **Test:** 215 geçiyor ✅

---

## 📝 TypeScript Desteği

```typescript
import { getCacheQuery, withTransaction, TransactionContext } from 'node-caching-mysql-connector-with-redis';

interface User {
  id: number;
  name: string;
  email: string;
}

const users = await getCacheQuery<User[]>('SELECT * FROM users WHERE id = ?', [123]);

await withTransaction(async (tx: TransactionContext) => {
  const result = await tx.query<{ insertId: number }>('INSERT INTO users...', [data]);
  return result.insertId;
});
```

---

## ⚠️ Önemli Notlar

* Okuma ağırlıklı sistemler için idealdir
* Varsayılan TTL: 40.000 saniye (~11 saat)
* `REDIS_ENABLED=false` ile cache devre dışı bırakılabilir
* Transaction içinde `tx.query()` kullanarak veri bütünlüğü sağlanır

---

## 🤝 Katkıda Bulunma

Katkılar memnuniyetle karşılanır!
Ayrıntılar için [CONTRIBUTING.md](../CONTRIBUTING.md) dosyasına göz atın.

---

## 📄 Lisans

MIT © [Ali Hayati Keleş](https://github.com/hayatialikeles)

---

**Node.js topluluğu için ❤️ ile üretildi.**

