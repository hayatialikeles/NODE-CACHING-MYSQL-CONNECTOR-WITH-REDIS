# NODE CACHING MYSQL CONNECTOR WITH REDIS

MySQL bağlantılarınızı yönetirken ve sorgu sonuçlarını Redis ile önbelleğe alarak uygulamanızın performansını artıran, production-ready bir Node.js kütüphanesi.

## Özellikler

- MySQL sorgu sonuçlarının Redis'te otomatik önbelleğe alınması
- Sayfalama desteği ile önbellekleme
- Veri güncellemeleri için önbellek temizleme
- Anahtar çakışmalarını önlemek için isim alanı (namespace) desteği
- Parametreli sorgular ile SQL injection koruması
- Otomatik yeniden deneme mekanizması (retry mechanism)
- Yapılandırılabilir connection pool
- Redis'i devre dışı bırakma seçeneği
- UUID ve sayısal ID desteği
- Sorgu seviyesinde veritabanı değiştirme desteği

## Kurulum

```bash
npm install node-caching-mysql-connector-with-redis
```

## Yapılandırma

Ortam değişkenlerinizi `.env` dosyasında ayarlayın:

```
# MySQL Veritabanı Değişkenleri (Zorunlu)
DB_HOST="localhost"              # Zorunlu
DB_USERNAME="root"               # Zorunlu
DB_NAME="veritabani_adiniz"      # Zorunlu
DB_PASSWORD=""                   # İsteğe bağlı (varsayılan: boş)
DB_PORT="3306"                   # İsteğe bağlı (varsayılan: 3306)
TIMEZONE="+00:00"                # İsteğe bağlı (varsayılan: +00:00)

# MySQL Connection Pool Ayarları
DB_CONNECTION_LIMIT="10"         # İsteğe bağlı (varsayılan: 10)
DB_QUEUE_LIMIT="0"               # İsteğe bağlı (varsayılan: 0 - sınırsız)
DB_CONNECT_TIMEOUT="10000"       # İsteğe bağlı (varsayılan: 10000ms)
DB_MULTIPLE_STATEMENTS="false"   # İsteğe bağlı (varsayılan: false)

# Redis Değişkenleri
REDIS_ENABLED="true"             # İsteğe bağlı (varsayılan: true)
REDIS_SERVER="localhost"         # Redis etkinse zorunlu
REDIS_PORT="6379"                # İsteğe bağlı (varsayılan: 6379)
REDIS_PASSWORD=""                # İsteğe bağlı
REDIS_VHOST="uygulamam"          # İsteğe bağlı - Redis anahtar öneki
```

## Kullanım Kılavuzu

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
const { getCacheQuery } = require('mysql-redis-connector');

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
const { getCacheQueryPagination } = require('mysql-redis-connector');

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
const { QuaryCache } = require('mysql-redis-connector');

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

```javascript
const { getArrayItem, addArrayItem, delKeyItem, delPrefixKeyItem, getRedisClient } = require('./redis.Connector');

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

## Yeni İyileştirmeler

### 1. Sorgu Seviyesinde Veritabanı Değiştirme
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

### 2. Otomatik Yeniden Deneme (Retry Mechanism)
Bağlantı hatalarında otomatik olarak 3 kez yeniden deneme yapar. Desteklenen hata kodları:
- `ECONNREFUSED`: Bağlantı reddedildi
- `ETIMEDOUT`: Zaman aşımı
- `ENOTFOUND`: Host bulunamadı
- `ER_CON_COUNT_ERROR`: Bağlantı limiti aşıldı

### 3. Redis'i Devre Dışı Bırakma
`REDIS_ENABLED=false` ayarlayarak Redis önbelleklemeyi tamamen devre dışı bırakabilirsiniz. Bu durumda tüm sorgular doğrudan veritabanından çalışır.

### 4. Gelişmiş Connection Pool
MySQL bağlantı havuzu artık daha fazla yapılandırma seçeneği sunuyor:
- Connection limit
- Queue limit
- Connect timeout
- Keep-alive desteği

### 5. UUID Desteği
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

## Lisans

MIT

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