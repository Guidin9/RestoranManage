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

```bash
git clone https://github.com/Guidin9/RestoranManage.git
cd RestoranManage
cp .env.example .env           # kökteki .env — Docker Compose bunu okur
# .env'i doldurun (APP_KEY, şifreler, VITE_API_URL zorunlu)
docker compose up -d --build
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --class=StaffSeeder
```

`APP_KEY` üretmek için: `docker compose run --rm backend php artisan key:generate --show`

Zorunlu değişkenler tanımsızsa Compose sessizce başlamak yerine anlaşılır bir hata verir.

### Dikkat edilecekler

- **`VITE_API_URL` derleme anında gömülür.** Değiştirdikten sonra `docker compose up -d --build`
  şart; sadece restart etmek hiçbir şeyi değiştirmez.
- **MySQL portu** `127.0.0.1:3306`'a bağlıdır, dışarı açık değildir. Sunucu güvenlik
  duvarında (Azure NSG vb.) yalnızca 80/443 açık olsun.
- **QR kodlar** panelin açıldığı adresi (`window.location.origin`) hedefler. HTTPS'i
  QR çıktısı almadan **önce** kurun, yoksa basılan kodlar yanlış adrese gider.

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
