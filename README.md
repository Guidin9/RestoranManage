# RestoranManage — QR Menü & Adisyon Sistemi

QR kod tabanlı restoran menüsü ve adisyon yönetimi. Müşteri masadaki QR kodu okutup
sipariş verir; garson, kasa ve yönetici kendi panellerinden süreci yönetir.

- **Backend:** Laravel 13 (API-only), PHP 8.4, MySQL, Sanctum token auth
- **Frontend:** React 19 + Vite (tek sayfa uygulama)

## Ekranlar

| Adres | Kim kullanır | Ne yapar |
|---|---|---|
| `/?table=<qr_code>` | Müşteri | Menüyü görür, sepet oluşturup sipariş verir. Giriş gerektirmez. |
| `/waiter` | Garson | Masa haritası (dolu/boş), adisyona ürün ekleme/çıkarma |
| `/cashier` | Kasa | Açık adisyonlar, hesap kapatma |
| `/admin` | Yönetici | Garson, masa, kategori, ürün yönetimi + QR çıktısı |

## Kurulum (yerel geliştirme)

**Backend** (`Qr_menu/`):

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed     # admin + kasa + 3 garson + örnek menü
php artisan serve              # http://127.0.0.1:8000
```

**Frontend** (`qr-menu-frontend/`):

```bash
npm install
cp .env.example .env           # VITE_API_URL=http://localhost:8000
npm run dev                    # http://localhost:5173
```

Testler: `php artisan test` (Pest, SQLite in-memory — MySQL gerekmez).

## Varsayılan hesaplar

`Qr_menu/.env` üzerinden yönetilir, `StaffSeeder` veritabanına yazar.
**Canlıya çıkmadan mutlaka değiştirin.**

| Ekran | Kullanıcı | Şifre |
|---|---|---|
| `/admin` | `admin` | `admin123` |
| `/cashier` | `kasa` | `123456` |
| `/waiter` | `ahmet` vb. | admin panelinden belirlenir |

Şifreyi değiştirdikten sonra: `php artisan db:seed --class=StaffSeeder`

> ⚠️ **Dolu veritabanında düz `php artisan db:seed` çalıştırmayın.** `DatabaseSeeder`
> `create()` kullanır ve garson/masa/ürün kayıtlarını çoğaltır. Sadece
> `--class=StaffSeeder` kullanın (tekrar çalıştırılabilir).

## Docker ile yayına alma

Dört konteyner: `caddy` (HTTPS + yönlendirme), `frontend` (nginx + React), `backend`
(Laravel), `db` (MySQL). Dışarıya yalnızca Caddy açıktır; API ile arayüz aynı adresten
servis edilir (`/api/*` Caddy tarafından backend'e proxy'lenir), bu yüzden ayrı bir
`api.*` alt alan adı gerekmez.

**Önkoşul — sunucunun bir alan adı olmalı.** Sertifika çıplak IP'ye alınamaz. Ücretsiz
yolu: Azure Portal > VM > Overview > DNS name > *Configure* ile bir etiket verin;
`restoranim.westeurope.cloudapp.azure.com` gibi bir ad alırsınız. Azure NSG'de **80 ve
443** dışarı açık olsun (80 sertifika doğrulaması için gerekir), 3306 kapalı kalsın.

```bash
git clone https://github.com/Guidin9/RestoranManage.git
cd RestoranManage
cp .env.example .env           # kökteki .env — Docker Compose bunu okur
# .env'i doldurun: SITE_ADDRESS, APP_KEY, DB_PASSWORD, ADMIN_PASSWORD, CASHIER_PASSWORD
docker compose up -d --build
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --class=StaffSeeder
```

`APP_KEY` üretmek için (sunucuda, `.env`'i doldurmadan önce):

```bash
echo "base64:$(openssl rand -base64 32)"
```

`artisan key:generate` ile üretmeye çalışmayın: Compose, backend servisini başlatmadan
**önce** `APP_KEY` zorunluluğunu kontrol eder, dolayısıyla anahtar henüz yokken
`docker compose run backend ...` komutu çalışmaz. Yukarıdaki `openssl` çıktısı
Laravel'in ürettiğiyle birebir aynı biçimdedir (`base64:` + 32 rastgele bayt).

Zorunlu değişkenler tanımsızsa Compose sessizce başlamak yerine anlaşılır bir hata verir.
Sertifikanın alındığını görmek için: `docker compose logs caddy`.

### Dikkat edilecekler

- **`SITE_ADDRESS` sadece host adıdır** — başına `https://`, sonuna `/` koymayın.
  `APP_URL` ve `VITE_API_URL` bundan türetilir, ayrıca elle girilmez.
- **`VITE_API_URL` derleme anında gömülür.** `SITE_ADDRESS` veya IMGBB anahtarını
  değiştirdikten sonra `docker compose up -d --build` şart; sadece restart etmek
  hiçbir şeyi değiştirmez.
- **`caddy_data` volume'ünü silmeyin** — sertifikalar orada durur. Silinirse Let's
  Encrypt'ten yeniden istenir ve haftalık limite takılabilirsiniz.
- **MySQL portu** `127.0.0.1:3306`'a bağlıdır, dışarı açık değildir. `backend` ve
  `frontend` ise hiç porta bağlanmaz; onlara sadece Caddy üzerinden erişilir.
- **QR kodlar** panelin açıldığı adresi (`window.location.origin`) hedefler. QR
  çıktısı almadan **önce** HTTPS'in çalıştığından emin olun; sonradan adres
  değişirse basılı kodların tamamı geçersiz olur.

## Mimari notları

- **Yetkilendirme:** Sanctum token'ları + rol bazlı ability (`admin`, `cashier`, `waiter`).
  Admin token'ı üçüne de sahiptir, çünkü panel garson uçlarını da kullanır.
  Müşteri menüsü (`GET /api/menu/{uuid}`) ve sipariş (`POST /api/orders`) uçları,
  müşterinin hesabı olmadığı için bilinçli olarak herkese açıktır.
- **Adisyon:** Bir masanın aynı anda tek açık adisyonu olur
  (`Order::firstOrCreate(table_id, status=active)`). Aynı masadan gelen yeni siparişler
  mevcut adisyona eklenir. Hesap kapatmak `status = paid` yapar, masayı boşaltan budur.
- **Fiyat:** `order_items.price_at_sale` sipariş anındaki fiyatı saklar; menü fiyatı
  değişince açık/geçmiş adisyonlar bozulmaz.
- **Görseller:** Ürün görselleri tarayıcıdan doğrudan ImgBB'ye yüklenir, backend yalnızca
  dönen URL'i saklar. `VITE_IMGBB_API_KEY` boşsa görsel yüklenemez.
  Not: `VITE_*` değerleri derlenmiş JS içinde herkese görünür.
- **Yönlendirme:** react-router yoktur; `App.jsx` içinde `window.location.pathname`
  ile yapılır. Production'da `nginx.conf` bunu `try_files` ile index.html'e düşürür.

Daha ayrıntılı geliştirici notları için `CLAUDE.md` dosyasına bakın.
