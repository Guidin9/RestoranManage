# Aşama 2 — devir notu

> Bu dosya, yarın kod tabanını yeniden taramadan devam etmek için var.
> **Önce bunu oku, keşif yapma.** Tasarım sistemi kuralları zaten
> `qr-menu-frontend/CLAUDE.md`'de (o dosya otomatik yükleniyor).

## Durum

**Aşama 1 bitti, canlıda.** Commit `781ca7e` — "Apple mekanigi (Asama 1)".
Kapsam: tasarım temeli (token/karanlık mod/hareket/materyal/tipografi) +
müşteri menüsü (`App.jsx`).

Kullanıcının onayladığı dört karar: palet ve Marcellus **kalır**, `motion`
kurulu, **karanlık mod var**, teslim iki aşamalı.

Kullanıcının ilk tepkisi: *"eskisine baya benzer geldi"* — bu beklenen sonuç
(seçilen seçenek "görünüm aynı kalsın"dı), ama **yön sorusu açık kaldı**.
Devam etmeden önce sor: Aşama 2'ye plandaki gibi mi devam, yoksa görünüm de
değişsin mi? Cevaba göre bu dosyanın geri kalanı geçerli ya da geçersiz.

## Aşama 1'de eklenen dosyalar (hepsi `qr-menu-frontend/src/`)

| Dosya | Ne yapar |
|---|---|
| `motion.js` | Yay preset'leri (`springSnappy/Default/Sheet/Momentum`), `RESPONSE`, `fadeOut`, `project()`, `rubberband()`, `nearest()`, `clamp()`, **`springTo()`** (elle entegre yay) |
| `useDragSheet.js` | Kesintiye uğratılabilir sürükleme: pointer capture, grab offset, 10px histerezis, hız halka tamponu (±5000 px/s sınırlı), rubber-band, momentum projeksiyonu, hız devri |
| `CartSheet.jsx` | Sepet. **Varsayılan TAM AÇIK**, gizli peek değil. 3 snap noktası, yükseklik animasyonu + transform overshoot |
| `Modal.jsx` + `useModalA11y.js` | `role=dialog`, Escape, odak tuzağı, odağı geri verme, **iOS-güvenli** kaydırma kilidi, giriş/çıkış animasyonu |
| `Toast.jsx` + `useToast.js` | 4 tür (`status/ok/warn/error`), 4sn otomatik, yukarı kaydırıp kapatma. `useToast()` hook'u ayrı dosyada (oxlint) |
| `iconScale.js` | `ICON = {xs:14, sm:16, md:18, lg:22, xl:28}` — `icons.jsx`'ten ayrı (fast refresh) |
| `tests/motion.spec.mjs` | `npm run test:motion` — 18 kontrol, fizik doğrulaması |

`index.css` (~1500 satır) tamamen elden geçti: karanlık mod, kontrast, tint
çiftleri, materyal token'ları, 4 basamaklı gölge ölçeği, tipografi ölçeği,
44px hit alanları, tek `@media (hover:hover)` bloğu, safe-area.

## Aşama 2 işi — 6 desen, sıfır yeni token

Ekranlar Aşama 1'de **hiç değiştirilmedi**, satır numaraları geçerli.

**P1 — Modal göçü.** `Cashier.jsx:271-285` ve `Waiter.jsx:274-381` el yapımı
`.modal-overlay`/`.modal` markup'ını `<Modal>` ile değiştir. Aynı anda
`index.css`'te `.modal-overlay` ve `.modal` üzerindeki `animation:`
bildirimlerini sil (Aşama 1'de bilerek bırakıldı, hâlâ CSS ile giriyorlar).

**P2 — Poll'a dayanıklı listeler.** `<AnimatePresence>` + `m.div`, mevcut
stabil `id` ile keyed:
- Kasa sipariş kartları `Cashier.jsx:216-264` (5sn poll)
- Mutfak fişleri `Kitchen.jsx:135-171` (4sn)
- Garson masa kartları `Waiter.jsx:243-269` (3sn)

Ödenen/servis edilen kart yok olmak yerine animasyonla çıkar — personel
ekranlarındaki en büyük algılanan kalite kazancı.

**P3 — Garson'un açık modal mutasyonu** (`Waiter.jsx:73-77`). 3sn'lik poll,
modal açıkken `setSelectedTable(updated)` çağırıp satırları kullanıcının
parmağının altında yeniden çiziyor. Veri akışına dokunmadan: `.line-row`
(`Waiter.jsx:290-308`) `m.div` + `AnimatePresence` ile sarılsın; ayrıca modal
içinde `pointerdown`'da set edilip `pointerup`'tan 800ms sonra temizlenen bir
`isInteracting` ref'i, set iken son yanıtı tamponlasın.

**P4 — Toast ve onaylar.** 18 `alert()` → `useToast()`, Türkçe metinler
**kelimesi kelimesine**:
- Waiter 139/149/160/170 · Cashier 98/118/129 · Kitchen 66/75
- Admin 91/95/99/117/122/141/161/169/186/191/215/219

4 `window.confirm()` (Admin 104/127/150/224) → `<Modal>` onayı
(`Cashier.jsx:273-283` şablon). Onay diyaloğu **sadece gerçekten yıkıcı**
olanda kalsın: `deleteCategory` (150) tüm ürünlere kaskad ediyor, o kesin.

**P5 — Yükleme durumları.** `Cashier.jsx:17`'deki ölü `loading` state'ini
silme, **kullan** (`useState(true)` + `panel-body`'de spinner, `Kitchen.jsx:126-127`
gibi). Sonra üç spinner'ı da yeni `.skel` sınıfıyla içerik biçimli iskelete
çevir — parıldayan bir kart iskeleti "verin geliyor" der, spinner "bir şey
ters gitti" der.

**P6 — Grafik teması.** `CashierSummary.jsx:35-41`'deki `C_SEA`/`C_OLIVE`/
`C_INK`/`C_DIM`/`C_FAINT`/`C_LINE`/`FONT` sabitlerini sil. Oradaki yorum yarı
doğru: SVG **presentation attribute**'ları (`fill="…"`) `var()` çözmez ama SVG
**CSS property**'leri çözer. `@layer components`'e sınıf yaz
(`.chart-bar { fill: var(--sea) }` vb.), grafikler karanlık modu bedava takip
etsin. Tek-ton-tek-iş ve `<title>` hover korunsun.

**Beşinde birden:** ikon çağrıları `ICON` ölçeğine (`./iconScale`);
`m.*` olan hiçbir elemanda `.reveal` kalmasın; `Admin.jsx` sekme geçişi
(281/315/348) `<AnimatePresence mode="wait">` + 150ms **cross-fade** (sekmeler
eş düzeyde, slide değil).

## Tekrar düşmemek için — Aşama 1'de bedeli ödenmiş tuzaklar

1. **Bu makinedeki Chrome'da `requestAnimationFrame` ~42 saniyede 1 kare
   çalışıyor.** Sayfa "visible" ve odakta görünüyor ama frame üretmiyor.
   Animasyon/zamanlama ile ilgili hiçbir tarayıcı gözlemine güvenme —
   "Motion bozuk", "yay bitmiyor", "AnimatePresence unmount etmiyor" gibi
   sonuçların hepsi bu yüzden çıkmış yanlış teşhislerdi. Ölçmek için:
   `let n=0; const t0=performance.now(); ...` 2 saniyede kaç kare?
   Görsel/statik kontrol (ekran görüntüsü, DOM, hesaplanmış stil) güvenilir.
2. **Bir kaydırma kutusunun içeriğini `scrollHeight` ile ölçme** — kutunun
   kendi boyunun altına inemez. İç elemandan `offsetHeight` al.
3. **Görünür kaydırma çubuğu + ResizeObserver = sayfayı donduran döngü**
   (çubuk içeriği daraltır → metin sarar → yükseklik değişir → yeniden ölçüm).
4. **`--shadow-inset` asla `none` olamaz** — `none`, bir `box-shadow` listesinin
   parçası olamaz, kural tümden düşer. Açıkta `inset 0 0 0 0 transparent`.
5. **Tailwind taraması `@source` ile src'ye sabitlendi.** Yollar CSS dosyasına
   göre çözülür, proje köküne göre değil. Bu olmadan CLAUDE.md'deki sınıf
   adlarından gerçek utility üretiliyordu.

## Doğrulama

```powershell
npm --prefix qr-menu-frontend run test:motion   # fizik, 18 kontrol
npm --prefix qr-menu-frontend run build         # Lightning CSS hataları burada patlar
npm --prefix qr-menu-frontend run lint
```

Build'den sonra bak: `dist/assets/*.css` içinde katmansız kalan **sadece** üç
`:root` bloğu, `@keyframes` ve Tailwind preflight olmalı.

Referans ölçüler (Aşama 1 sonrası): CSS 43.19 kB / **9.37 kB gz**,
JS 330 kB / **101.7 kB gz** (taban 70.19 gz idi, Motion +31.5 gz).

Yerel backend gerekirse `[[yerel-backend-sqlite-ile-calistirma]]` hafıza notu.
Deploy: doğrudan `main`, sonra `deploy` skill'i (`--build frontend`).

## Açık kalan tek doğrulama

**Sepet sürükleme jesti gerçek bir telefonda denenmedi** (yukarıdaki rAF
sorunu yüzünden). Fizik testli, kod gözden geçirildi, çıkışta
`pointer-events: none` emniyeti var — ama parmakla hissi kullanıcı onaylamalı.
