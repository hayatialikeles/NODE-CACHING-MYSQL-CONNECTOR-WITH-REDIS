# NODE CACHING MYSQL CONNECTOR WITH REDIS

[![npm version](https://img.shields.io/npm/v/node-caching-mysql-connector-with-redis.svg)](https://www.npmjs.com/package/node-caching-mysql-connector-with-redis)
[![Test Coverage](https://img.shields.io/badge/coverage-97.47%25%20statements-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![Tests](https://img.shields.io/badge/tests-129%20passing-brightgreen.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![Backward Compatible](https://img.shields.io/badge/backward%20compatible-100%25-blue.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![TypeScript](https://img.shields.io/badge/TypeScript-definitions%20included-blue.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)

MySQL bağlantılarınızı yönetirken ve sorgu sonuçlarını Redis ile önbelleğe alarak uygulamanızın performansını artıran, production-ready bir Node.js kütüphanesi.

## Özellikler

### 🚀 Core Features
- MySQL sorgu sonuçlarının Redis'te otomatik önbelleğe alınması
- Sayfalama desteği ile önbellekleme
- Veri güncellemeleri için önbellek temizleme
- **TypeScript desteği** - Tam tip tanımlamaları ile IntelliSense
- **Doğrudan Redis fonksiyon erişimi** - getArrayItem, addArrayItem, vs.
- Parametreli sorgular ile SQL injection koruması
- UUID ve sayısal ID desteği
- Sorgu seviyesinde veritabanı değiştirme desteği

### 🧠 Smart Auto Features (v2.6.0+) ✨ NEW
- **Auto Cache Key Generation** - SQL'den otomatik cache key oluşturma (manuel key gerekmez!)
- **Auto Invalidation** - INSERT/UPDATE/DELETE'de otomatik cache temizleme
- **Zero Config** - `CORE_AUTO_FEATURES=true` ile aktif
- **100% Backward Compatible** - Eski kodunuz aynen çalışır

### ⚡ Production-Grade Features (v2.5.3)
- **Automatic Reconnection** - Bağlantı koptuğunda otomatik yeniden bağlanma
- **Query Timeout Protection** - Uzun süren sorguları timeout ile durdurma
- **Bulk Operations** - Büyük veri setleri için chunked bulk insert
- **Graceful Shutdown** - Uygulama kapanırken bağlantıları güvenle kapatma
- **Pool Monitoring** - Connection pool istatistikleri ile monitoring
- **Enhanced Config Validation** - Eksik/hatalı konfigürasyonlar için detaylı hata mesajları

### 🔧 Infrastructure
- Anahtar çakışmalarını önlemek için isim alanı (namespace) desteği
- Otomatik yeniden deneme mekanizması (exponential backoff)
- Yapılandırılabilir connection pool
- Redis'i devre dışı bırakma seçeneği

## Kurulum

```bash
npm install node-caching-mysql-connector-with-redis
```

## Test ve Kalite

Kütüphane **%97+ test coverage** ile production-ready kalite garantisi sunar:
- ✅ **%97.47 Statement Coverage**
- ✅ **%88.11 Branch Coverage**
- ✅ **%100 Function Coverage**
- ✅ **129 Kapsamlı Unit Test** (Tümü başarılı) 🆕
- ✅ **%100 Backward Compatible** - v2.4.x kodunuz çalışmaya devam eder
- ✅ **Auto Features** testleri (auto key, auto invalidation) 🆕
- ✅ **Production Features** testleri (bulkInsert, timeout, graceful shutdown)
- ✅ **Configuration Validation** testleri
- ✅ **Otomatik Retry Mekanizması** testleri
- ✅ **Error Handling & Edge Cases** testleri
- ✅ **Redis & MySQL Mock** testleri (proxyquire)

Testleri çalıştırmak için:
```bash
npm test                  # Testleri çalıştır
npm run coverage          # Coverage raporu oluştur (HTML + Terminal)
```

## Yapılandırma

### Hızlı Başlangıç

1. `.env.example` dosyasını kopyalayın:
```bash
cp .env.example .env
```

2. `.env` dosyasını düzenleyin:

```env
# MySQL Veritabanı Değişkenleri (ZORUNLU)
DB_HOST=localhost              # ✅ Zorunlu
DB_USERNAME=root               # ✅ Zorunlu
DB_NAME=veritabani_adiniz      # ✅ Zorunlu
DB_PASSWORD=                   # İsteğe bağlı (varsayılan: boş)
DB_PORT=3306                   # İsteğe bağlı (varsayılan: 3306)
TIMEZONE=+00:00                # İsteğe bağlı (varsayılan: +00:00)

# MySQL Connection Pool Ayarları (İSTEĞE BAĞLI)
DB_CONNECTION_LIMIT=10         # İsteğe bağlı (varsayılan: 10)
DB_QUEUE_LIMIT=0               # İsteğe bağlı (varsayılan: 0 - sınırsız)
DB_CONNECT_TIMEOUT=10000       # İsteğe bağlı (varsayılan: 10000ms)
DB_MULTIPLE_STATEMENTS=false   # İsteğe bağlı (varsayılan: false)

# Redis Değişkenleri
REDIS_ENABLED=true             # İsteğe bağlı (varsayılan: true)
REDIS_SERVER=localhost         # ⚠️ Redis etkinse zorunlu
REDIS_PORT=6379                # İsteğe bağlı (varsayılan: 6379)
REDIS_PASSWORD=                # İsteğe bağlı
REDIS_VHOST=uygulamam          # İsteğe bağlı - Redis anahtar öneki
```

### Konfigürasyon Validasyonu

v2.5.3+ ile eksik veya hatalı konfigürasyonlarda detaylı hata mesajları alırsınız:

```
❌ Configuration Error - Missing or invalid environment variables:

  • DB_HOST is required (e.g., DB_HOST=localhost)
  • REDIS_SERVER is required when Redis is enabled (e.g., REDIS_SERVER=localhost).
    Set REDIS_ENABLED=false to disable Redis.

💡 Tip: Copy .env.example to .env and configure your settings:
  cp .env.example .env
```

## 🚀 Quick Start (v2.6.0)

### Ultra-Simple Setup with Auto Features

```bash
# 1. Install
npm install node-caching-mysql-connector-with-redis

# 2. Configure .env
cp .env.example .env

# 3. Enable smart features
echo "CORE_AUTO_FEATURES=true" >> .env
```

### Zero-Config Usage

```javascript
const { getCacheQuery, QuaryCache } = require('node-caching-mysql-connector-with-redis');

// ✨ Okuma - Cache key otomatik!
const users = await getCacheQuery(
    'SELECT * FROM users WHERE id = ?',
    [123]
    // cacheName yok - otomatik: "users:id:a7b3c2d1"
);

// ✨ Yazma - Cache invalidation otomatik!
await QuaryCache(
    'INSERT INTO users (name, email) VALUES (?, ?)',
    ['Ali', 'ali@example.com']
    // resetCacheName yok - otomatik: users_*, users:* temizlenir
);
```

**Sonuç:** Manuel cache key yok, manuel invalidation yok! 🎉

---

## Kullanım Kılavuzu

### Import

**JavaScript:**
```javascript
// Tüm fonksiyonları import et
const {
    // Database fonksiyonları
    QuaryCache,
    getCacheQuery,
    getCacheQueryPagination,

    // Production-grade features (v2.5.3+)
    bulkInsert,
    getCacheQueryWithTimeout,
    closeConnections,
    getPoolStats,

    // v2.6.0 Smart Features ✨
    enableAutoKey,
    enableAutoInvalidation,
    configure,

    // Redis fonksiyonları
    getArrayItem,
    addArrayItem,
    delKeyItem,
    delPrefixKeyItem,
    getRedisClient
} = require('node-caching-mysql-connector-with-redis');
```

**TypeScript:**
```typescript
import {
    // Database fonksiyonları
    QuaryCache,
    getCacheQuery,
    getCacheQueryPagination,

    // Production-grade features (v2.5.3+)
    bulkInsert,
    getCacheQueryWithTimeout,
    closeConnections,
    getPoolStats,

    // Redis fonksiyonları
    getArrayItem,
    addArrayItem,
    delKeyItem,
    delPrefixKeyItem,
    getRedisClient,

    // Type definitions
    type QueryResult,
    type PaginationResult,
    type BulkInsertOptions,
    type BulkInsertResult,
    type QueryTimeoutOptions,
    type PoolStats
} from 'node-caching-mysql-connector-with-redis';
```

### Temel Önbellekli Sorgu

`getCacheQuery` fonksiyonu, SQL sorgularını çalıştırır ve sonuçları Redis'te önbelleğe alarak sonraki çağrılarda performansı artırır.

#### Fonksiyon İmzası

```javascript
getCacheQuery(sql, parameters, cacheName, database = null)
```

- `sql`: Parametreli yer tutucular (?) içeren SQL sorgu metni
- `parameters`: Yer tutucuları değiştirecek parametre değerlerinin dizisi
- `cacheName`: Önbellekteki sonuç için benzersiz tanımlayıcı
- `database`: (Opsiyonel) Sorgu çalıştırılacak veritabanı adı

#### Örnek

```javascript
const { getCacheQuery } = require('node-caching-mysql-connector-with-redis');

// Belirli bir şirketin tüm kullanıcılarını getir (varsayılan DB)
getCacheQuery(
  "SELECT * FROM users WHERE company_id = ?",
  [companyId],
  `userlist-${companyId}`
)
.then(data => {
  // Veriyi işle
  console.log(data);
})
.catch(err => {
  console.error(err);
});

// Farklı bir veritabanından veri çek (database parametresi ile)
getCacheQuery(
  "SELECT * FROM products WHERE category_id = ?",
  [categoryId],
  `products-${categoryId}`,
  'ecommerce_db'  // Sorgu bu veritabanında çalışır
)
.then(data => {
  console.log(data);
})
.catch(err => {
  console.error(err);
});
```

### Sayfalama ile Önbellekli Sorgu

`getCacheQueryPagination` fonksiyonu, sorgu sonuçlarının otomatik önbellekleme ile sayfalanmasını sağlar.

#### Fonksiyon İmzası

```javascript
getCacheQueryPagination(sql, parameters, cacheName, page, pageSize = 30, database = null)
```

- `sql`: Parametreli yer tutucular (?) içeren SQL sorgu metni
- `parameters`: Yer tutucuları değiştirecek parametre değerlerinin dizisi
- `cacheName`: Önbellekteki sonuç için benzersiz tanımlayıcı
- `page`: Sayfa numarası (0 tabanlı indeks)
- `pageSize`: Sayfa başına öğe sayısı (varsayılan: 30)
- `database`: (Opsiyonel) Sorgu çalıştırılacak veritabanı adı

#### Örnek

```javascript
const { getCacheQueryPagination } = require('node-caching-mysql-connector-with-redis');

// Ürünlerin sayfalanmış listesini getir (varsayılan DB)
getCacheQueryPagination(
  "SELECT * FROM products WHERE category = ? ORDER BY created_at DESC",
  [categoryId],
  `products-category-${categoryId}-page-${page}`,
  page,
  25  // Sayfa başına 25 öğe
)
.then(result => {
  // Şunları içeren bir nesne döndürür:
  // - totalCount: toplam kayıt sayısı
  // - pageCount: toplam sayfa sayısı
  // - detail: istenen sayfa için kayıt dizisi
  console.log(`Gösterilen sayfa: ${page + 1} / ${result.pageCount}`);
  console.log(`Toplam kayıt: ${result.totalCount}`);
  console.log(result.detail);
})
.catch(err => {
  console.error(err);
});

// Farklı bir veritabanından sayfalanmış veri
getCacheQueryPagination(
  "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
  [userId],
  `orders-user-${userId}-page-${page}`,
  page,
  20,
  'analytics_db'  // Sorgu bu veritabanında çalışır
)
.then(result => {
  console.log(result);
})
.catch(err => {
  console.error(err);
});
```

### Veri Güncelleme ve Önbellek Temizleme

`QuaryCache` fonksiyonu, yazma işlemlerini (INSERT, UPDATE, DELETE) gerçekleştirir ve ilgili önbellek girişlerini geçersiz kılar.

#### Fonksiyon İmzası

```javascript
QuaryCache(sql, parameters, resetCacheName = null, database = null)
```

- `sql`: Parametreli yer tutucular (?) içeren SQL sorgu metni
- `parameters`: Yer tutucuları değiştirecek parametre değerlerinin dizisi
- `resetCacheName`: Geçersiz kılınacak önbellek anahtarı deseni (isteğe bağlı)
- `database`: (Opsiyonel) Sorgu çalıştırılacak veritabanı adı

#### Örnek

```javascript
const { QuaryCache } = require('node-caching-mysql-connector-with-redis');

// Yeni bir kullanıcı ekle ve kullanıcı listesi önbelleğini temizle (varsayılan DB)
QuaryCache(
  "INSERT INTO users SET fullname = ?, email = ?, password = ?, company_id = ?",
  [fullname, email, hashedPassword, companyId],
  `userlist-${companyId}` // Bu desen ile eşleşen tüm anahtarları temizler
)
.then(result => {
  console.log(`Kullanıcı eklendi, ID: ${result.insertId}`);
})
.catch(err => {
  console.error(err);
});

// Farklı bir veritabanında ürün güncelle
QuaryCache(
  "UPDATE products SET stock = stock - ? WHERE product_id = ?",
  [quantity, productId],
  `products-${productId}`,
  'inventory_db'  // Sorgu bu veritabanında çalışır
)
.then(result => {
  console.log(`Ürün güncellendi, etkilenen satır: ${result.affectedRows}`);
})
.catch(err => {
  console.error(err);
});
```

## Redis İsim Alanı (Namespace)

Kütüphane, `REDIS_VHOST` ortam değişkeni aracılığıyla Redis anahtar isim alanını destekler. Bu, birden fazla uygulama aynı Redis örneğini paylaştığında anahtar çakışmalarını önler.

`REDIS_VHOST` ayarlandığında, tüm anahtarlar otomatik olarak `{REDIS_VHOST}:` öneki ile başlar. Örneğin, `REDIS_VHOST=uygulamam` ile `userlist-123` adlı bir önbellek anahtarı, Redis'te `uygulamam:userlist-123` olarak saklanır.

## Hata Yönetimi

Tüm fonksiyonlar Promise döndürür, böylece `.then()/.catch()` ile Promise zincirleri veya async/await sözdizimini kullanabilirsiniz:

```javascript
// async/await kullanımı
async function getUserData(companyId) {
  try {
    const users = await getCacheQuery(
      "SELECT * FROM users WHERE company_id = ?",
      [companyId],
      `userlist-${companyId}`
    );
    return users;
  } catch (error) {
    console.error("Kullanıcılar getirilemedi:", error);
    throw error;
  }
}
```

## Redis Connector Kullanımı

Kütüphane, Redis bağlantısını `redis.Connector.js` modülü üzerinden yönetir. Bu modül şu fonksiyonları sağlar:

- `getArrayItem(key)`: Redis'ten veri okur
- `addArrayItem(key, data, expiryDate)`: Redis'e veri yazar (varsayılan TTL: 40.000 saniye)
- `delKeyItem(key)`: Belirli bir anahtarı siler
- `delPrefixKeyItem(prefix)`: Belirli bir önek ile başlayan tüm anahtarları siler
- `getRedisClient()`: Ham Redis client nesnesine erişim sağlar

Redis anahtarları otomatik olarak `REDIS_VHOST` değeri ile öneklenir (eğer ayarlanmışsa).

### Redis Connector Kullanım Örnekleri

Artık Redis fonksiyonlarına doğrudan paketin ana export'undan erişebilirsiniz:

```javascript
const {
    getArrayItem,
    addArrayItem,
    delKeyItem,
    delPrefixKeyItem,
    getRedisClient
} = require('node-caching-mysql-connector-with-redis');

// Veri okuma
async function readFromCache() {
  const data = await getArrayItem('user-list-123');
  if (data.length > 0) {
    console.log('Önbellekten veri okundu:', data);
  } else {
    console.log('Önbellekte veri bulunamadı');
  }
}

// Veri yazma (özel TTL ile)
async function writeToCache() {
  const userData = [
    { id: 1, name: 'Ali', email: 'ali@example.com' },
    { id: 2, name: 'Ayşe', email: 'ayse@example.com' }
  ];
  
  // 1 saatlik TTL (3600 saniye)
  await addArrayItem('user-list-123', userData, 3600);
  console.log('Veri önbelleğe yazıldı');
}

// Belirli bir anahtarı silme
async function deleteCacheKey() {
  await delKeyItem('user-list-123');
  console.log('Anahtar silindi');
  
  // Birden fazla anahtarı silme
  await delKeyItem(['user-list-123', 'user-list-456', 'user-list-789']);
  console.log('Birden fazla anahtar silindi');
}

// Önek ile tüm anahtarları silme
async function deleteCacheByPrefix() {
  // "user-list-" ile başlayan tüm anahtarları sil
  await delPrefixKeyItem('user-list-');
  console.log('user-list- öneki ile başlayan tüm anahtarlar silindi');
  
  // Birden fazla önek ile silme
  await delPrefixKeyItem(['user-list-', 'product-list-', 'order-']);
  console.log('Belirtilen öneklerle başlayan tüm anahtarlar silindi');
}

// Ham Redis client kullanımı
async function useRedisClient() {
  const client = getRedisClient();
  
  // Özel Redis komutları için
  client.set('custom-key', 'custom-value', 'EX', 3600);
  
  // Redis info komutu
  client.info((err, info) => {
    if (!err) console.log('Redis bilgileri:', info);
  });
}

// REDIS_VHOST kullanımı örneği
// .env dosyasında: REDIS_VHOST=myapp
// Bu durumda 'user-list-123' anahtarı Redis'te 'myapp:user-list-123' olarak saklanır
```

## TypeScript Kullanımı

Paket, tam TypeScript desteği ile gelir. IntelliSense, auto-completion ve type checking ile güvenli kod yazın.

### ✨ TypeScript Avantajları

- ✅ **Tam Tip Güvenliği** - Compile-time'da hata yakalama
- ✅ **IntelliSense Desteği** - IDE'de otomatik tamamlama
- ✅ **Generic Types** - Sorgu sonuçlarınız için özel tipler
- ✅ **Type Inference** - Akıllı tip çıkarımı
- ✅ **JSDoc ile Dokümantasyon** - Hover'da detaylı açıklamalar

### Tip Güvenliği ile Kullanım

```typescript
import {
    getCacheQuery,
    getCacheQueryPagination,
    QuaryCache,
    type PaginationResult
} from 'node-caching-mysql-connector-with-redis';

// Interface tanımla
interface User {
    id: number;
    name: string;
    email: string;
    company_id: number;
    created_at: Date;
}

interface Product {
    id: number;
    name: string;
    price: number;
    category_id: number;
}

// Tip güvenli sorgu
async function getUsers(companyId: number): Promise<User[]> {
    return await getCacheQuery<User>(
        "SELECT * FROM users WHERE company_id = ?",
        [companyId],
        `users-company-${companyId}`
    );
}

// Tip güvenli sayfalama
async function getProducts(
    categoryId: number,
    page: number
): Promise<PaginationResult<Product>> {
    return await getCacheQueryPagination<Product>(
        "SELECT * FROM products WHERE category_id = ?",
        [categoryId],
        `products-cat-${categoryId}-page-${page}`,
        page,
        25
    );
}

// Kullanım
const users = await getUsers(123);
users.forEach(user => {
    console.log(user.name); // Type-safe! IntelliSense çalışır
    console.log(user.email); // ✅
    // console.log(user.unknownField); // ❌ TypeScript hatası!
});

const productPage = await getProducts(5, 0);
console.log(`Total products: ${productPage.totalCount}`);
console.log(`Total pages: ${productPage.pageCount}`);
productPage.detail.forEach(product => {
    console.log(`${product.name}: $${product.price}`);
});
```

## Tam Kullanım Örneği (JavaScript)

```javascript
const {
    // Database functions
    getCacheQuery,
    QuaryCache,

    // Redis functions
    addArrayItem,
    delPrefixKeyItem
} = require('node-caching-mysql-connector-with-redis');

// Örnek: E-ticaret uygulaması

// 1. Ürünleri cache'den oku
async function getProducts(categoryId) {
    const products = await getCacheQuery(
        "SELECT * FROM products WHERE category_id = ? AND active = 1",
        [categoryId],
        `products-category-${categoryId}`
    );
    return products;
}

// 2. Yeni ürün ekle ve cache'i temizle
async function addProduct(name, categoryId, price) {
    const result = await QuaryCache(
        "INSERT INTO products SET name = ?, category_id = ?, price = ?",
        [name, categoryId, price],
        `products-category-${categoryId}` // Bu kategori cache'ini temizle
    );
    return result.insertId;
}

// 3. Redis'i doğrudan kullan
async function cacheUserSession(userId, sessionData) {
    await addArrayItem(`session-${userId}`, sessionData, 3600); // 1 saat TTL
}

// 4. Farklı DB'den veri çek
async function getAnalytics(date) {
    return await getCacheQuery(
        "SELECT * FROM daily_stats WHERE date = ?",
        [date],
        `analytics-${date}`,
        'analytics_db' // Farklı veritabanı
    );
}
```

## Yeni İyileştirmeler

### 1. Kapsamlı Test Coverage ✅
Versiyon 2.5.0 ile birlikte:
- **%100 Statement Coverage** - Tam kod kapsama
- **%93.82 Branch Coverage** - Karar noktaları
- **%100 Function Coverage** - Tüm fonksiyonlar test edildi
- **54 Otomatik Test** (unit + integration + edge cases + backward compatibility)
- Mock-based testing (Redis & MySQL)
- Configuration validation testleri
- Error handling testleri
- Continuous testing desteği

```bash
npm test            # Testleri çalıştır
npm run coverage    # Coverage raporu (HTML + Terminal)
```

### 2. Sorgu Seviyesinde Veritabanı Değiştirme
Artık her sorgu için farklı bir veritabanı belirtebilirsiniz. Bu özellik, aynı MySQL sunucusunda birden fazla veritabanı ile çalışmanız gerektiğinde kullanışlıdır.

```javascript
// Örnek: analytics_db veritabanından veri çek
getCacheQuery(
  "SELECT * FROM user_stats WHERE date = ?",
  [today],
  `stats-${today}`,
  'analytics_db'  // Farklı DB
)
```

Tüm fonksiyonlar (`QuaryCache`, `getCacheQuery`, `getCacheQueryPagination`) artık opsiyonel `database` parametresi kabul eder.

### 3. Otomatik Yeniden Deneme (Retry Mechanism)
Bağlantı hatalarında otomatik olarak 3 kez yeniden deneme yapar. Desteklenen hata kodları:
- `ECONNREFUSED`: Bağlantı reddedildi
- `ETIMEDOUT`: Zaman aşımı
- `ENOTFOUND`: Host bulunamadı
- `ER_CON_COUNT_ERROR`: Bağlantı limiti aşıldı

### 4. Redis'i Devre Dışı Bırakma
`REDIS_ENABLED=false` ayarlayarak Redis önbelleklemeyi tamamen devre dışı bırakabilirsiniz. Bu durumda tüm sorgular doğrudan veritabanından çalışır.

### 5. Gelişmiş Connection Pool
MySQL bağlantı havuzu artık daha fazla yapılandırma seçeneği sunuyor:
- Connection limit
- Queue limit
- Connect timeout
- Keep-alive desteği

### 6. UUID Desteği
Artık hem sayısal ID'ler hem de UUID formatındaki ID'ler destekleniyor. Sayfalama fonksiyonu tüm kayıt türleriyle uyumlu.

## En İyi Uygulamalar

1. **Anlamlı Önbellek Anahtarları Seçin**: Önbellek anahtarlarınızı benzersiz kılmak için tanımlayıcılar ekleyin (örn. `products-category-${categoryId}`).

2. **Uygun Son Kullanma Süreleri Ayarlayın**: Varsayılan önbellek süresi 40.000 saniyedir (~11 saat). Veri değişkenliğinize göre bu süreyi ayarlayın.

3. **Önbellek Temizlemeyi Yönetin**: Veri değişikliklerinden sonra, önbellekteki verileri güncel tutmak için uygun önbellek desenleriyle `QuaryCache` fonksiyonunu çağırın.

4. **İsim Alanlarını Kullanın**: Paylaşılan Redis ortamlarında anahtar çakışmalarını önlemek için `REDIS_VHOST` ortam değişkenini ayarlayın.

5. **Her Zaman Parametreli Sorgular Kullanın**: SQL enjeksiyon saldırılarını önlemek için değerleri asla doğrudan SQL metinlerine birleştirmeyin.

6. **Connection Pool Ayarlarını Optimize Edin**: Uygulamanızın yüküne göre `DB_CONNECTION_LIMIT` ve `DB_QUEUE_LIMIT` değerlerini ayarlayın.

7. **Hata Durumlarını Yönetin**: Retry mekanizması otomatik olarak bağlantı hatalarını yönetir, ancak uygulama kodunuzda da hata yakalama kullanın.

8. **Veritabanı Değiştirme Özelliğini Akıllıca Kullanın**: Farklı veritabanlarına erişirken, önbellek anahtarlarınıza veritabanı adını da ekleyerek çakışmaları önleyin (örn. `analytics_db:stats-${today}`).

## Production-Grade Features (v2.5.3+)

### 🚀 Bulk Insert (Toplu Veri Ekleme)

Büyük veri setlerini otomatik chunking ile güvenli şekilde ekleyin:

```javascript
const { bulkInsert } = require('node-caching-mysql-connector-with-redis');

// Basit kullanım
const users = [
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' },
    // ... 10,000 kayıt
];

const result = await bulkInsert('users', users);
console.log(result);
// { insertedRows: 10000, chunks: 10 }

// Gelişmiş seçenekler
await bulkInsert('users', users, {
    chunkSize: 500,           // Her chunk'ta 500 kayıt (varsayılan: 1000)
    database: 'analytics_db', // Farklı database
    resetCacheName: 'users_'  // Cache temizleme
});
```

**Özellikler:**
- ✅ Otomatik chunking (varsayılan: 1000 kayıt/chunk)
- ✅ Memory-safe (büyük veri setleri için)
- ✅ Otomatik cache invalidation
- ✅ Database switching desteği
- ✅ Retry mechanism ile hata toleransı

---

### ⏱️ Query Timeout Protection

Uzun süren sorguları timeout ile durdurun:

```javascript
const { getCacheQueryWithTimeout } = require('node-caching-mysql-connector-with-redis');

try {
    const users = await getCacheQueryWithTimeout(
        'SELECT * FROM users WHERE status = ?',
        ['active'],
        'active-users',
        {
            timeout: 5000,           // 5 saniye timeout
            database: 'analytics_db' // Opsiyonel
        }
    );
} catch (err) {
    if (err.message.includes('timeout')) {
        console.error('Query timeout exceeded!');
    }
}
```

**Özellikler:**
- ✅ Varsayılan timeout: 30 saniye
- ✅ Cache'den okumada timeout uygulanmaz (instant)
- ✅ Promise.race ile implementation
- ✅ Otomatik connection release

---

### 🛑 Graceful Shutdown

Uygulamanızı güvenle kapatın:

```javascript
const { closeConnections } = require('node-caching-mysql-connector-with-redis');

// Express.js örneği
const server = app.listen(3000);

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');

    // 1. HTTP server'ı kapat
    server.close(() => {
        console.log('HTTP server closed');
    });

    // 2. Database bağlantılarını kapat
    await closeConnections();

    // 3. Process'i kapat
    process.exit(0);
});
```

**Özellikler:**
- ✅ Tüm connection pool'u güvenle kapatır
- ✅ Shutdown sırasında yeni query'leri reddeder
- ✅ Mevcut query'lerin tamamlanmasını bekler
- ✅ Memory leak önleme

---

### 📊 Pool Monitoring

Connection pool istatistiklerini takip edin:

```javascript
const { getPoolStats } = require('node-caching-mysql-connector-with-redis');

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = getPoolStats();

    res.json({
        status: 'ok',
        database: {
            totalConnections: stats.totalConnections,
            activeConnections: stats.activeConnections,
            freeConnections: stats.freeConnections,
            queuedRequests: stats.queuedRequests
        }
    });
});

// Monitoring loop
setInterval(() => {
    const stats = getPoolStats();

    if (stats.queuedRequests > 10) {
        console.warn('⚠️ High queue depth:', stats.queuedRequests);
    }

    if (stats.freeConnections === 0) {
        console.warn('⚠️ No free connections available!');
    }
}, 10000);
```

**Özellikler:**
- ✅ Real-time pool statistics
- ✅ Connection leak detection
- ✅ Performance monitoring
- ✅ Alert sistemleri için

---

### 🔄 Automatic Reconnection

Bağlantı koptuğunda otomatik yeniden bağlanma:

```javascript
// Otomatik olarak aktif - yapılandırma gerekmez!

// Bu query bağlantı koptuğunda otomatik retry yapar
const data = await getCacheQuery(
    'SELECT * FROM users',
    [],
    'all-users'
);
```

**Özellikler:**
- ✅ Exponential backoff (1s, 2s, 4s)
- ✅ 3 retry denemesi (varsayılan)
- ✅ Aşağıdaki hatalarda otomatik retry:
  - `ECONNREFUSED` - Bağlantı reddedildi
  - `ETIMEDOUT` - Zaman aşımı
  - `ENOTFOUND` - Host bulunamadı
  - `PROTOCOL_CONNECTION_LOST` - Bağlantı koptu
  - `ER_CON_COUNT_ERROR` - Çok fazla bağlantı

---

## Lisans

MIT

## Migration Guide (v2.4.x → v2.5.0)

### ✅ %100 Geriye Dönük Uyumlu!

v2.5.0, v2.4.x ile **tamamen uyumludur**. Kodunuzu değiştirmenize gerek yok!

#### Eski Kod (v2.4.x) - Hala Çalışıyor ✅

```javascript
const dbConnector = require('node-caching-mysql-connector-with-redis');

dbConnector.QuaryCache(...);
dbConnector.getCacheQuery(...);
dbConnector.getCacheQueryPagination(...);
```

#### Yeni Kod (v2.5.0) - Önerilen 🌟

```javascript
const {
    QuaryCache,
    getCacheQuery,
    getCacheQueryPagination,
    // Artık Redis fonksiyonları da erişilebilir!
    getArrayItem,
    addArrayItem,
    delKeyItem
} = require('node-caching-mysql-connector-with-redis');

QuaryCache(...);
getCacheQuery(...);
```

#### Hibrid Kullanım - Her İkisi de Desteklenir ✅

```javascript
// Eski kod - değiştirmeyin
const dbConnector = require('node-caching-mysql-connector-with-redis');
dbConnector.getCacheQuery(...);

// Yeni kod - aynı projede
const { addArrayItem } = require('node-caching-mysql-connector-with-redis');
addArrayItem(...);
```

### Yeni Özellikler (Breaking Change YOK)

1. ✅ **Redis Fonksiyonları Direkt Erişilebilir**
   - Artık `./redis.Connector` import'una gerek yok
   - Ana paketten destructure edebilirsiniz

2. ✅ **Sorgu Seviyesinde DB Değiştirme**
   - Yeni opsiyonel `database` parametresi
   - Eski kodunuz çalışmaya devam eder

3. ✅ **Geliştirilmiş Error Handling**
   - Error kodları korunuyor
   - Retry mekanizması daha güvenilir

## Versiyon Geçmişi

### v2.5.3 (2025-01-05) - Production-Grade Release 🚀
- ✅ **Bulk Insert** - Chunked bulk operations (1000 kayıt/chunk)
- ✅ **Query Timeout Protection** - Timeout ile query koruması (varsayılan: 30s)
- ✅ **Graceful Shutdown** - `closeConnections()` ile güvenli kapanma
- ✅ **Pool Monitoring** - `getPoolStats()` ile real-time statistics
- ✅ **Automatic Reconnection** - PROTOCOL_CONNECTION_LOST retry desteği
- ✅ **Enhanced Config Validation** - Detaylı hata mesajları ile validation
- ✅ **.env.example** - Tam konfigürasyon template'i
- ✅ **73 Kapsamlı Test** - Production features testleri
- ✅ **%97.47 Statement Coverage**
- ✅ **%88.11 Branch Coverage**
- ✅ **%100 Function Coverage**

### v2.5.2 (2025-01-05)
- ✅ **TypeScript Desteği** - Tam tip tanımlamaları (.d.ts)
- ✅ IntelliSense ve auto-completion desteği
- ✅ Generic types ile type-safe queries

### v2.5.0 (2025-01-05)
- ✅ **%100 Backward Compatible** - v2.4.x kodunuz değişmeden çalışır
- ✅ **Doğrudan Redis Erişimi** - Redis fonksiyonlarına ana export'tan erişim
- ✅ **Sorgu seviyesinde veritabanı değiştirme** özelliği
- ✅ 54 Kapsamlı Test (unit + integration + edge cases + backward compatibility)
- ✅ Configuration validation testleri
- ✅ Error handling & retry mechanism testleri

### v2.4.x
- Redis'i devre dışı bırakma özelliği
- Otomatik retry mekanizması
- UUID desteği
- Gelişmiş connection pool

## Gelecek Yol Haritası

Kütüphanenin gelecek versiyonlarında planlanan geliştirmeler:

1. **Redis Cluster Desteği**: Yüksek kullanılabilirlik ve ölçeklenebilirlik için Redis Cluster desteği.

2. **Otomatik Önbellek Yenileme**: Belirli bir süre sonra otomatik olarak önbelleği arka planda yenileme özelliği.

3. **İzleme ve Metrikler**: Önbellek isabet oranı, sorgu performansı ve Redis durum metrikleri için izleme araçları.

4. **Dağıtılmış Kilit Mekanizması**: Eşzamanlı istemciler arasında veri tutarlılığını sağlamak için dağıtılmış kilit desteği.

5. **Şema Değişikliği Yönetimi**: Veritabanı şeması değişikliklerinde önbelleği otomatik temizleme mekanizması.

6. **TypeScript Desteği**: Tam TypeScript tiplerini ve desteklerini içeren TypeScript sürümü.

7. **İnce Ayarlı Önbellek Stratejileri**: LRU, TTL, FIFO gibi farklı önbellekleme stratejileri arasında seçim yapma olanağı.

8. **Olay Tabanlı Önbellek Geçersiz Kılma**: Uygulama olaylarına dayalı otomatik önbellek geçersiz kılma sistemi.

## GitHub Deposu

[https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS](https://github.com/hayatialikeles/NODE-CACHING-MYSQL-CONNECTOR-WITH-REDIS)