# TASARIM.md — UI Çalışma Rehberi

Frontend (arayüz) tasarımı üzerinde çalışırken izlenecek düzen. Canlı sistem
`main` branch'inden `restoranmanage.francecentral.cloudapp.azure.com` adresinde
çalışıyor; buradaki amaç onu bozmadan tasarım geliştirmek.

---

## 1. Nerede çalışılır — `dev` branch'i

`main` = canlıda olan. `dev` = tasarım deneme alanı. **Doğrudan `main`'de tasarım
denemesi YAPMA.**

```bash
cd C:\Users\anils\Desktop\Project
git checkout dev
npm --prefix qr-menu-frontend run dev    # http://localhost:5173
```

Dev sunucusu anlık yenilenir (hot reload): dosyayı kaydettiğin an tarayıcıda görürsün,
build beklemek yok. Tasarımı burada, canlıya dokunmadan istediğin kadar dene.

---

## 2. Beğenilen tasarımı canlıya alma

Önce git, sonra sunucu.

**Yerelde:**
```bash
git checkout main
git merge dev
git push origin main
```

**Sunucuda** (SSH: `ssh -i "C:\Users\anils\Desktop\RestoranManage_key.pem" Gui@20.19.211.64`):
```bash
cd ~/RestoranManage
git pull
sudo docker compose up -d --build frontend
```

- **`--build` ZORUNLU.** Vite kodu derleme anında paketler; sadece `restart` hiçbir
  şeyi değiştirmez.
- `--build frontend` yalnızca frontend konteynerini yeniler (30-60 sn). Backend ve DB'ye
  dokunulmaz, canlı sipariş akışı kesilmez.
- Sunucuda **Compose V2** kullanılır: `docker compose` (boşluklu). Eski `docker-compose`
  (tireli) V1 BuildKit imajlarında bozuktur — kullanma. `docker` **sudo** ister (`Gui`
  docker grubunda değil).
- Backend de değiştiyse UI ile birlikte: `sudo docker compose up -d --build backend frontend`
  ve ardından `sudo docker compose exec -T backend php artisan migrate --force`.

---

## 3. Hangi dosyalar editlenir

| Dosya | Ekran | Not |
|---|---|---|
| `src/App.jsx` | Müşteri menüsü (QR) | En çok uğraşılacak yer; müşteri deneyimi |
| `src/Waiter.jsx` | Garson paneli | Masa haritası, sipariş ekle/çıkar |
| `src/Cashier.jsx` | Kasa | Açık adisyonlar, hesap kapatma |
| `src/Admin.jsx` | Yönetici | Ürün / masa / garson CRUD |
| `src/index.css` | Global stiller | Renk paleti, font, arka plan gibi genel şeyler |

Görünüş, bu dosyalardaki `style={{}}` blokları ve `index.css` içinde. Mantığa
(fonksiyonlar, `apiFetch`, `useState`) dokunmadan sadece bunları değiştirerek ekranı
baştan giydirebilirsin.

---

## 4. BOZMA — korunması gereken kalıplar

- **`src/api.js`'e dokunma.** Tüm API iletişimi, token ve base URL burada. Tasarım için
  girmene gerek yok; değiştirirsen canlıdaki auth kırılır.
- **`apiFetch(...)` çağrılarını olduğu gibi bırak.** Veriyi getiren o. Bir ekranı
  yeniden giydirirken sadece etrafındaki JSX/stili değiştir, bu satırları silme.
- **Dosya adı büyük/küçük harf.** `App.jsx` içinde `import Admin from './Admin'` yazar.
  Windows umursamaz ama sunucudaki Linux umursar — adı `admin.jsx` yaparsan yerelde
  çalışır, canlıda **build patlar**. Mevcut adları koru: `App`, `Admin`, `Cashier`, `Waiter`.
- **Tailwind v4 BAĞLI** (`@tailwindcss/vite`). `className="flex gap-4"` çalışır. Ama kural şu:

  > **2+ yerde geçen isimlendirilmiş tasarım nesnesi** (`.btn`, `.panel`, `.prod-card`)
  > `index.css`'te `@layer components` içinde kalır. **Tek seferlik yerleşim/boşluk**
  > utility ile yazılır (`mt-5`, `flex-1`, `text-center`).

  `.btn`'i JSX'e `inline-flex items-center gap-1.5 px-4 py-2.5 ...` diye açma: 6 ekrana
  kopyalanır, bugün tek yerden değişen buton yarın 40 yerden değişir.
- **`index.css`'e yazdığın her kural bir `@layer` içinde olmalı.** Katmansız CSS *tüm*
  utility'leri yener — dışarıda bırakırsan `className="prod-card mb-3"` yazdığında `mb-3`
  sessizce çalışmaz ve "Tailwind bozuk" sanırsın.
- **Renk paleti kilitli.** `@theme { --color-*: initial }` ile Tailwind'in hazır rampaları
  kaldırıldı: `bg-blue-500` **derlenmez**. Renk lazımsa `bg-sea` / `text-ink` / `bg-olive`
  gibi Mavi Liman token'larını kullan. Yeni renk = önce `:root`'a token, sonra `@theme inline`
  köprüsüne bir satır.
- **`:root` tek kaynak.** `var(--sea)` ve `bg-sea` aynı değere çözülür; `@theme inline`
  sayesinde ayrı bir `--color-sea` üretilmez. Token değerini **sadece `:root`'ta** değiştir.
- **`.reveal` + `style={{'--i': index}}`'e dokunma.** `animation-delay: calc(var(--i,0)*55ms)`
  utility'ye çevrilmemeli; bu, kalan tek meşru inline `style`.
- **Fontlar `index.html`'de** `<link>` ile. `index.css`'e `@import url(...)` ile geri koyma:
  `@import 'tailwindcss'` build'de açıldığı için font import'u arkada kalır ve sessizce düşer.
- **Yönlendirme `App.jsx` içinde** `window.location.pathname` ile. react-router kurma;
  yeni ekran = App.jsx'e bir `pathname` kontrolü daha.
- **`?table=<uuid>` parametresi** müşteri menüsünün olmazsa olmazı. Menüyü yerelde test
  ederken URL'e `?table=...` eklemezsen 404 alırsın.
- **Lint:** `npm run lint` (eslint değil, **oxlint**). Push'tan önce çalıştır.

---

## 5. Claude ile verimli tasarım çalışması

1. **Somut söyle.** "Güzelleştir" yerine "kart düzeni, üstte kategori sekmeleri, koyu
   tema" gibi. Belirsizse birkaç yön sunulur, sen seçersin.
2. **Referans ver.** Beğendiğin uygulamanın ekran görüntüsünü yapıştır ("bunun gibi").
   Görsel okunabiliyor, tasarım ona yaklaştırılır.
3. **Tarayıcıdan gösterilebilir.** `npm run dev` açıkken Claude Chrome'da sayfayı açıp
   ekran görüntüsü alıp sonucu kendi görüp düzeltebilir.
4. **Küçük parça iste.** Dört ekranı aynı anda değil; önce müşteri menüsünü bitir, beğen,
   sonra diğerine geç. `dev`'de küçük commit'lerle biriktir, geri almak kolay olsun.
5. **Canlı güvende.** Claude `dev`'de çalışır; sen beğenip merge etmeden `main`'e hiçbir
   şey gitmez, sunucu da sen "yayınla" demeden değişmez.

---

## Hızlı komut özeti

```bash
# Tasarıma başla
git checkout dev
npm --prefix qr-menu-frontend run dev

# Ara kayıt
git add -A && git commit -m "..."

# Yayınla (yerel)
git checkout main && git merge dev && git push origin main

# Yayınla (sunucu)
ssh -i "C:\Users\anils\Desktop\RestoranManage_key.pem" Gui@20.19.211.64
cd ~/RestoranManage && git pull && sudo docker compose up -d --build frontend
```
