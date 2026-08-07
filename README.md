# RestoranManage — QR Menü & Adisyon Sistemi

QR kod tabanlı restoran menüsü ve adisyon yönetimi. Müşteri masadaki QR kodu okutup
sipariş verir; garson, kasa ve yönetici kendi panellerinden süreci yönetir.

- **Backend:** Laravel 13 (API-only), PHP 8.4, MySQL, Sanctum token auth
- **Frontend:** React 19 + Vite (tek sayfa uygulama), "Mavi Liman" Akdeniz tasarım sistemi

## Proje Durumu

**Canlı:** https://restoranmanage.francecentral.cloudapp.azure.com — Azure Linux VM'de
Docker ile yayında, HTTPS çalışıyor (Caddy + Let's Encrypt). Son güncelleme: 2026-07-17.

**Tamamlandı**
- Dört ekran (müşteri / garson / kasa / yönetici) çalışır durumda ve canlıda.
- Docker ile canlıya alındı: 4 konteyner (caddy, frontend, backend, db), yalnızca 80/443 dışa açık.
- HTTPS uçtan uca doğrulandı; **Docker Compose V2** sunucuda; deploy akışı temiz.
- **"Mavi Liman" arayüzü** — Claude Design'dan içe aktarılan Akdeniz teması (kireç taşı zemin,
  koyu petrol paneller, Marcellus + Hanken Grotesk fontları, deniz mavisi/zeytin/terakota aksanlar,
  SVG çizgi ikonlar). Dört ekranın tamamına uygulandı (`src/index.css` merkezi tasarım sistemi).
- **Müşteri masa hesabı:** menüde masanın açık adisyon toplamı + sipariş edilen ürünlerin listesi,
  her üründe "Servis edildi / Hazırlanıyor" durum etiketiyle; 5 sn'de bir canlı yenilenir.
- **Aynı ürün birleştirme:** bir masaya aynı üründen tekrar sipariş gelince (çok kişi ya da garson)
  kasada ayrı satır açılmaz, mevcut kalemin adedi artar.
- **Garson sepeti:** modalda ürünler önce sepete toplanır (aynı ürün adet artırır), "Siparişi Gönder"
  ile toplu yollanır.
- **Kasa gün özeti dashboard'u:** tarih seçimli; günlük kazanç, kapanan masa, satılan ürün, ortalama
  masa tutarı + haftalık/aylık ortalamalar + grafikler (son 14 gün ciro trendi, günün çok satanları).
- **Üç aşamalı sipariş akışı + Mutfak paneli:** ayrı `/kitchen` girişi (fiyatsız); sipariş
  Hazırlanıyor → (mutfak hazırlar) Servise Hazır → (garson/kasa servis eder) Servis Edildi. Ürün
  bazında işaretleme; servis bekleyen sipariş için garson/kasada uyarı şeridi + kart rozeti.

**Yarım / bekleyen**
- Menü içeriği boş: masa, kategori ve ürünler `/admin` panelinden elle eklenecek.
- QR kodları henüz basılmadı (adres kalıcı, hazır olunca admin panelinden basılabilir).
- UI çalışması doğrudan `main` üzerinde ilerliyor — tasarım sistemi kuralları
  `qr-menu-frontend/CLAUDE.md`'de.

## Ekranlar

| Adres | Kim kullanır | Ne yapar |
|---|---|---|
| `/?table=<qr_code>` | Müşteri | Menüyü görür, sepet oluşturup sipariş verir; masanın güncel hesabını ve sipariş listesini (Hazırlanıyor/Servise hazır/Servis edildi) görür. Giriş gerektirmez. |
| `/kitchen` | Mutfak | Gelen siparişleri fiyatsız görür; ürünleri (ürün bazında veya "Tümünü Hazırla") **Hazır** işaretler. |
| `/waiter` | Garson | Masa haritası (dolu/boş + servis bekleyen uyarısı); modalda adisyon, sepet→gönder, ürün eksiltme, hazır ürünleri **Servis Et**. |
| `/cashier` | Kasa | "Açık Hesaplar": adisyonlar, servis işaretleme, hesap kapatma. "Gün Özeti": grafikli günlük/haftalık/aylık rapor. |
| `/admin` | Yönetici | Garson, masa, kategori, ürün yönetimi + QR çıktısı |

## Özellikler (sipariş akışı)

Online yemek platformlarına benzer üç aşamalı akış: **Hazırlanıyor → Servise Hazır → Servis Edildi.**

1. Müşteri QR'ı okutur → menüyü, masanın açık hesabını ve o ana kadarki siparişleri (durum etiketli) görür.
2. Sepete ekler → "Sepeti Onayla" ile gönderir; aynı ürün tekrar gelirse adisyonda tek satırda birleşir.
3. Yeni sipariş **Mutfak** panelinde "Hazırlanıyor" olarak belirir (fiyatsız). Mutfak ürünü **Hazır** işaretler.
4. Hazır olan ürün **Garson** (veya Kasa) ekranında "servis bekliyor" uyarısı yaratır (banner + rozet).
5. Garson/Kasa **Servis Et** işaretler → müşteri ekranında "Servis edildi" olur.
6. Kasa hesabı kapatır (`paid`) → masa boşalır; ciro gün özetine yansır.

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

Testler: `php artisan test` (Pest, SQLite in-memory — MySQL gerekmez). Lint: `npm run lint` (oxlint).

## Varsayılan hesaplar

`Qr_menu/.env` üzerinden yönetilir, `StaffSeeder` veritabanına yazar.
**Canlıya çıkmadan mutlaka değiştirin.**

| Ekran | Kullanıcı | Şifre |
|---|---|---|
| `/admin` | `admin` | `admin123` |
| `/cashier` | `kasa` | `123456` |
| `/kitchen` | `mutfak` | `123456` |
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

> **Compose V2 gerekir.** Komutlar `docker compose` (boşluklu) şeklindedir. Eski
> `docker-compose` (tireli) V1, BuildKit imajlarında `ContainerConfig` hatası verir —
> kullanmayın. V2 yoksa resmi binary'yi kurun:
> `sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose`.
> `docker` `sudo` gerektiriyorsa tüm komutların başına `sudo` ekleyin.

**Önkoşul — sunucunun bir alan adı olmalı.** Sertifika çıplak IP'ye alınamaz. Ücretsiz
yolu: Azure Portal > VM > Overview > DNS name > *Configure* ile bir etiket verin;
`restoranim.westeurope.cloudapp.azure.com` gibi bir ad alırsınız. Azure NSG'de **80 ve
443** dışarı açık olsun (80 sertifika doğrulaması için gerekir), 3306 kapalı kalsın.

```bash
git clone https://github.com/Guidin9/RestoranManage.git
cd RestoranManage
cp .env.example .env           # kökteki .env — Docker Compose bunu okur
# .env'i doldurun: SITE_ADDRESS, APP_KEY, DB_PASSWORD, ADMIN_PASSWORD, CASHIER_PASSWORD, KITCHEN_PASSWORD
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

### Değişiklik yayınlama

```bash
git pull
# Yalnızca UI değiştiyse (30-60 sn, backend/db'ye dokunulmaz):
sudo docker compose up -d --build frontend
# Backend de değiştiyse (yeni migration dahil):
sudo docker compose up -d --build backend frontend
sudo docker compose exec -T backend php artisan migrate --force
# Personel hesabı eklendiyse (ör. mutfak) bir defalık:
sudo docker compose exec -T backend php artisan db:seed --class=StaffSeeder --force
```

VM yeniden başlatılırsa: dört servisin de `restart: always` politikası var, Docker
açılışta otomatik kaldırır. Gelmezse `cd ~/RestoranManage && sudo docker compose up -d`
(build gerekmez). **Asla `down -v` yapmayın** — `db_data` volume'ünü, yani gerçek veriyi siler.

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
  (`Order::firstOrCreate(table_id, status=active)`). Yeni siparişler mevcut adisyona eklenir;
  **aynı üründen zaten varsa yeni satır açılmaz, adet artar.** Hesap kapatmak `status = paid`
  yapar (`paid_at` damgalanır), masayı boşaltan budur.
- **Teslim takibi:** `order_items.delivered_quantity` her kalemin kaç adedinin teslim
  edildiğini tutar. `pending = quantity − delivered_quantity`; bekleyen > 0 ise "teslim
  bekliyor" uyarısı çıkar. "Teslim Edildi" tüm kalemleri `delivered_quantity = quantity` yapar.
  Birleştirmeyle uyumludur: teslim edilmiş bir ürüne yeni adet eklenince tekrar bekleyen oluşur.
- **Fiyat:** `order_items.price_at_sale` sipariş anındaki fiyatı saklar; menü fiyatı
  değişince açık/geçmiş adisyonlar bozulmaz. Toplamlar hep bundan hesaplanır.
- **Gün özeti:** `paid_at`'e göre günlük/haftalık/aylık ciro, kapanan masa, satılan ürün
  ve trend/çok-satan verisi `GET /api/cashier/summary?date=...` ile döner.
- **Görseller:** Ürün görselleri tarayıcıdan doğrudan ImgBB'ye yüklenir, backend yalnızca
  dönen URL'i saklar. `VITE_IMGBB_API_KEY` boşsa görsel yüklenemez.
  Not: `VITE_*` değerleri derlenmiş JS içinde herkese görünür.
- **Yönlendirme:** react-router yoktur; `App.jsx` içinde `window.location.pathname`
  ile yapılır. Production'da `nginx.conf` bunu `try_files` ile index.html'e düşürür.

Daha ayrıntılı geliştirici notları için `CLAUDE.md` dosyasına bakın.
