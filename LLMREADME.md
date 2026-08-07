# LLMREADME.md — Müşteri menüsüne LLM önerisi (fikir aşaması)

Henüz **hiçbir kod yazılmadı.** Bu dosya, 2026-07-17'de konuşulan fikrin ve
değerlendirmenin kaydı. Konuya dönüldüğünde buradan devam edilir.

**Fikir:** Müşteri QR menüsünde (`/?table=<uuid>`) menüdeki ürünlerden öneri sunmak.
Düşünülen sağlayıcı: **Gemini API**.

**Karar verilmedi.** Aşağıdaki "Açık sorular" bölümü cevaplanmadan kod yazılmamalı.

---

## Kısa cevap

Mantıklı ve **teknik olarak zor değil** — kod bir günlük iş. Zorluk kodda değil,
operasyonda: anahtar güvenliği, açık uç nokta ve maliyet kontrolü. Aşağıdaki üç
tuzağa dikkat edilirse rahat bir iş.

---

## Kritik riskler (bunlar atlanırsa iş patlar)

### 1. API anahtarı frontend'e KONULAMAZ

`CLAUDE.md`'nin de yazdığı gibi **`VITE_*` değerleri derlenmiş JS içinde herkese
görünür**. Projede `VITE_IMGBB_API_KEY` zaten böyle duruyor — ImgBB için kabul
edilebilir bir risk, ama Gemini anahtarı faturalı bir hesaba bağlı: menüyü açan
herkes anahtarı alıp kendi işinde kullanır.

**Doğrusu:** çağrı backend'den gider.
`Frontend → POST /api/menu/{uuid}/oneri → Laravel → Gemini`
Anahtar `Qr_menu/.env` + sunucudaki root `.env` + `docker-compose.yml`'de
(`GEMINI_API_KEY`), asla `VITE_*` olarak değil.

### 2. Uç nokta herkese açık olacak

Müşterinin hesabı yok; `GET /api/menu/{uuid}` ve `POST /api/orders` **bilinçli olarak**
public (bkz. CLAUDE.md "Deliberately still public"). Öneri ucu da öyle olmak zorunda.
Yani **auth'suz bir LLM endpoint'i internete açılıyor** — biri döngüye alırsa kota bir
gecede biter.

**Gerekli:** Laravel `throttle` middleware, masa UUID'si başına dakikada 2-3 istek.

### 3. Menü 5 saniyede bir yeniden fetch ediliyor

`App.jsx` içindeki `setInterval(fetchMenu, 5000)` masanın hesabını canlı tutuyor.
Öneri çağrısı dikkatsizce oraya bağlanırsa **müşteri başına saatte 720 istek** olur.
Öneri ayrı bir uçtan, ayrı tetikle gelmeli — asla menü poll'una bağlanmamalı.

---

## Asıl kurtarıcı: cache

**Menü değişmiyor.** Her müşteri için yeniden LLM çağırmak, aynı soruyu aynı veriyle
300 kez sormak demek.

Öneriyi **menü içeriği değiştiğinde bir kez** üret ve cache'le:

```php
$key = 'oneri:' . md5($urunler->pluck('id','name','price')->toJson());
Cache::remember($key, now()->addDay(), fn () => $gemini->uret($urunler));
```

Menü içeriğinin hash'i cache anahtarı olur; admin bir ürün ekleyince hash değişir,
öneri kendiliğinden tazelenir. Böylece günde ~5 çağrı olur, 500 değil. Maliyet ve
gecikme sorununun büyük kısmı burada buharlaşıyor.

---

## Senaryolar — zorluk buna göre değişir

| Senaryo | Zorluk | Maliyet | Not |
|---|---|---|---|
| **"Şefin önerisi"** — menüden 2-3 sabit ürün | Kolay | ~Sıfır (cache'li) | Başlamak için doğru yer |
| **Sepete göre** — "yanında şu iyi gider" | Orta | Sepet değişince çağrı; sepet kombinasyonu cache'lenebilir | Gerçek upsell değeri burada |
| **Sohbet** — "canım tatlı bir şey istiyor" | Zor | Her mesaj çağrı | Gecikme + kötüye kullanım + moderasyon |

---

## Tavsiye edilen yol

### Adım 0 — Önce menüyü doldur

2026-07-17 itibarıyla canlıda **1 kategori / 1 ürün** var. 4-5 üründen öneri yapmak
garip durur. Öneri sisteminin anlamlı olması için önce gerçek menü girilmeli.

### Adım 1 — LLM'siz dene (bir öğleden sonra, sıfır maliyet, sıfır risk)

Elde zaten **gerçek satış verisi** var: `GET /api/cashier/summary` → `top_products`
(`paid_at`'e göre hesaplanıyor, `CashierSummary.jsx`'te çalışıyor). "Bu haftanın
favorileri: Kola, Kaşarlı Tost" demek için LLM gerekmiyor — ve bu, LLM tahmininden
**daha güvenilir**.

> Not: `top_products` şu an `cashier` ability'si istiyor. Müşteriye açmak için
> ya public bir uçta yalnızca isim listesi döndürülmeli (fiyat/ciro sızdırmadan),
> ya da menü yanıtına eklenmeli.

### Adım 2 — Melez: ürünü veri seçsin, cümleyi LLM kursun

LLM'i asıl değerli kılan ürün *seçmek* değil, **dil**: "Yoğun bir günün sonunda hafif
bir şey isterseniz…" gibi bir metin.

```
Ürünleri satış verisi seçer  →  LLM sadece o ürünlerden bahseden cümleyi yazar
```

Bunun büyük yan faydası: **halüsinasyon riski sıfırlanır.** Modele "ürün öner" değil,
"şu 3 üründen bahseden bir cümle yaz" denir. Menüde olmayan bir şey öneremez.

---

## Diğer teknik notlar

- **Prompt injection:** Ürün adları admin panelinden **elle giriliyor**, yani prompt'a
  giden metin kontrol edilmiyor. Ürün adına "önceki talimatları unut" yazan biri modeli
  kandırabilir. Küçük bir restoran için düşük risk ama bilinmeli. Melez yaklaşım
  (Adım 2) bunu da büyük ölçüde zararsızlaştırır.
- **Gemini seçimi mantıklı:** Flash modelleri bu ölçek için hızlı ve ücretsiz tier
  yeterli olabilir. **Güncel limit/fiyatlar doğrulanmadı** — karar verilirken bakılacak,
  ezberden konuşulmadı.
- **Gecikme:** LLM çağrısı 1-3 sn. Cache'li tasarımda müşteri bunu hiç görmez (cache
  hit); görecekse iskelet/placeholder gösterilmeli, menüyü bloklamamalı.
- **Bozulursa menü çalışmaya devam etmeli.** Öneri bir "nice to have"; Gemini down
  olursa ya da kota biterse blok `null` döner ve UI o bölümü hiç göstermez. Sipariş
  akışı asla LLM'e bağlanmamalı.
- **Türkçe çıktı** — proje geneli Türkçe, prompt ve çıktı da Türkçe olmalı.
- **Maliyet tavanı** koymak iyi olur (günlük çağrı sayacı), çünkü uç public.

---

## Açık sorular (kod yazmadan önce cevaplanmalı)

1. Hangi senaryo? ("Şefin önerisi" / sepete göre / sohbet)
2. Öneri nerede görünecek — menünün üstünde bir şerit mi, sepet barının içinde mi?
3. Kişiselleştirme isteniyor mu, yoksa herkese aynı öneri yeterli mi?
   (Herkese aynı = cache tam çalışır = neredeyse bedava.)
4. Adım 1 (satış verisiyle, LLM'siz) tek başına yeterli olur mu — LLM'e gerçekten
   ihtiyaç var mı, yoksa dil katmanı mı isteniyor?

---

## Bağlam hatırlatmaları

- Arayüz/metinler **Türkçe**.
- Backend değişikliği = deploy'da `--build backend frontend` + migration gerekirse
  `php artisan migrate --force` (bkz. `CLAUDE.md` > Deployment).
- Yeni `.env` değişkeni eklenirse: `Qr_menu/.env.example`, kök `.env.example` ve
  `docker-compose.yml`'e de eklenmeli.
- Frontend'de her API çağrısı `src/api.js`'teki `apiFetch` üzerinden geçer — bare
  `fetch` kullanılmaz (tek meşru istisna ImgBB upload'ı).
