import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useTransform } from 'motion/react';
import { clamp, fadeOut, springDefault } from './motion';
import { useDragSheet } from './useDragSheet';
import { IconBag, IconCheck } from './icons';
import { ICON } from './iconScale';

/* =========================================================================
   Sepet.

   ÖNEMLİ — 2026-07-17 emsali: sepet GİZLİ BİR "PEEK" DEĞİLDİR. Mount
   anındaki hâli bugünküyle birebir aynı: çanta satırı + sayaç + ürün
   listesi + toplam + onay butonu, hepsi açık. Sürükleme jesti tamamen
   EK bir yetenek; hiçbir şeyi varsayılan olarak gizlemez.

   Mekanik ayrım: kabuk sticky ve onay butonu ALTTA olduğu için tüm
   yüzeyi y ile ötelemek butonu ekrandan çıkarırdı. Bu yüzden
   - gerçek durum .cart-lines'ın YÜKSEKLİĞİ (layout işi, contain ile
     sepet alt ağacına hapsedildi),
   - sınır aşımının esnek kısmı ise y transform'u (compositor, bedava).
   Giriş/çıkış animasyonu dış .cart-sheet'te, sürükleme iç .cart-bar'da:
   iki transform aynı elemanı paylaşamaz.
   ========================================================================= */

const DEFAULT_HEIGHT = 104;  // bugünkü .cart-lines max-height'ı
const MAX_VIEWPORT_RATIO = 0.4;

const formatTL = (value) =>
  value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CartSheet({ cart, total, onSubmit }) {
  const listRef = useRef(null);
  const [natural, setNatural] = useState(DEFAULT_HEIGHT);
  // Durum snap NOKTASININ İNDEKSİ (0 = kapalı, son = tam açık). İsimli mod
  // ('default' / 'full') tutmak yanıltıcıydı: liste kısa olduğunda "varsayılan"
  // ile "tam" aynı yüksekliğe denk geliyor ve isim tabanlı döngü bozuluyor.
  const [snapIndex, setSnapIndex] = useState(1);

  // Listenin doğal yüksekliği — ekranın %40'ıyla tavanlanıyor.
  // ResizeObserver, "satır sayısı değişti" varsaymaktan daha doğru: ürün adı
  // iki satıra sarınca, adet iki haneye çıkınca veya font geç yüklenince de
  // liste boyu değişiyor ve bunların hiçbiri cart.length'e yansımıyor.
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return undefined;

    const measure = () => {
      const cap = Math.round(window.innerHeight * MAX_VIEWPORT_RATIO);
      const next = Math.max(24, Math.min(element.offsetHeight, cap));
      // Alt piksel gürültüsünü yut: ölçüm → yükseklik → yeniden ölçüm
      // döngüsüne kapı aralamasın.
      setNatural((current) => (Math.abs(current - next) > 1 ? next : current));
    };
    measure();

    // rAF'a ertelemek "ResizeObserver loop" uyarısını da önler: gözlem
    // döngüsünün içinden layout tetiklemiyoruz.
    let queued = 0;
    const schedule = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(queued);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  const defaultHeight = Math.min(DEFAULT_HEIGHT, natural);
  const snapPoints = useMemo(
    () => (natural > defaultHeight + 8 ? [0, defaultHeight, natural] : [0, defaultHeight]),
    [natural, defaultHeight],
  );

  // Hook her pointerdown'da taze snap noktası ister; ref üzerinden
  // veriyoruz ki callback kimliği her ölçümde değişmesin.
  const snapRef = useRef(snapPoints);
  snapRef.current = snapPoints;
  const getSnapPoints = useCallback(() => snapRef.current, []);

  const activeIndex = clamp(snapIndex, 0, snapPoints.length - 1);
  const currentTarget = snapPoints[activeIndex];

  // Yaya en son hangi hedefin verildiği. Aşağıdaki senkron etkisi buna bakıp
  // "zaten oraya gidiliyor" durumunda karışmıyor — karışsaydı jest biter
  // bitmez animasyonu sıfır hızla baştan başlatır ve momentumu öldürürdü.
  const settledTo = useRef(null);

  const handleSnap = useCallback(
    (target) => {
      settledTo.current = target;
      const index = snapPoints.indexOf(target);
      if (index >= 0) setSnapIndex(index);
    },
    [snapPoints],
  );

  const { value, bind, snapTo, isDragging } = useDragSheet({
    initial: DEFAULT_HEIGHT,
    getSnapPoints,
    direction: -1,          // parmak aşağı → liste kısalır
    onSnap: handleSnap,
    onTap: () => {
      // Jest kullanamayanlar için: tutamaca dokunmak snap'ler arasında döner
      const next = (activeIndex + 1) % snapPoints.length;
      setSnapIndex(next);
      snapTo(snapPoints[next]);
    },
  });

  // Ürün eklenip/çıkıp liste boyu DEĞİŞTİĞİNDE mevcut moda göre yeniden yerleş.
  // Koşul şart: mode her değiştiğinde yeniden yerleşseydi, sürükleme biter
  // bitmez animasyonu sıfır hızla baştan başlatır ve hız devrini öldürürdük —
  // fiskenin momentumu tam da orada kaybolurdu.
  // currentTarget sepetin nerede olması gerektiğinin TEK kaynağı: hem ürün
  // eklenip liste boyu değiştiğinde hem de snap indeksi başka bir yoldan
  // değiştiğinde yükseklik onu takip eder. (Önceden yalnızca "liste boyu
  // değişti mi" bakılıyordu; indeks ile gerçek yükseklik ayrışabiliyor,
  // aria-expanded "kapalı" derken sepet açık kalabiliyordu.)
  useLayoutEffect(() => {
    if (isDragging) return;
    if (settledTo.current === currentTarget) return;

    const first = settledTo.current === null;
    settledTo.current = currentTarget;
    if (Math.abs(value.get() - currentTarget) < 1) return;
    // İlk yerleşimde animasyon yok: sepet zaten girişte canlanıyor
    if (first) value.set(currentTarget);
    else snapTo(currentTarget);
  }, [currentTarget, isDragging, snapTo, value]);

  // Sınır aşımının esnek kısmını yükseklikten ayır: yükseklik kırpılır,
  // taşma transform'a gider.
  const minSnap = 0;
  const maxSnap = Math.max(...snapPoints);
  const height = useTransform(value, (v) => clamp(v, minSnap, maxSnap));
  const overshoot = useTransform(value, (v) => {
    if (v > maxSnap) return -(v - maxSnap);
    if (v < minSnap) return minSnap - v;
    return 0;
  });

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <m.div
      className="cart-sheet"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1, pointerEvents: 'auto' }}
      // Çıkarken tıklamaları geçir: sepet alta yapışık olduğu için, çıkış
      // yarım kalırsa altındaki ürün kartlarını erişilemez bırakırdı.
      exit={{ y: 24, opacity: 0, pointerEvents: 'none' }}
      transition={{ opacity: fadeOut, y: springDefault }}
    >
      <m.div className="cart-bar" style={{ y: overshoot }}>
        <button
          type="button"
          className="sheet-grip"
          aria-expanded={activeIndex > 0}
          aria-label="Sepet listesini genişlet veya daralt"
          {...bind}
        />

        <div className="cart-top">
          <div className="cart-bag">
            <IconBag size={ICON.lg} />
            <span className="cart-count">{count}</span>
          </div>
          <span className="cart-title">Sepetim</span>
          <span className="cart-meta">{count} ürün</span>
        </div>

        <m.div
          className="cart-lines"
          style={{ height, willChange: isDragging ? 'height' : 'auto' }}
        >
          <ul ref={listRef} className="cart-lines-inner">
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <m.li
                  key={item.id}
                  className="cart-line"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ opacity: fadeOut, x: springDefault }}
                >
                  <span className="cart-qty">{item.quantity}×</span>
                  <span className="cart-name">{item.name}</span>
                  <span className="cart-price">{formatTL(item.price * item.quantity)} ₺</span>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </m.div>

        <div className="cart-foot">
          <div className="flex-1">
            <div className="cart-total-label">Toplam</div>
            <div className="cart-total">{total} ₺</div>
          </div>
          <button onClick={onSubmit} className="btn btn-success">
            Sepeti Onayla
            <IconCheck size={ICON.sm} />
          </button>
        </div>
      </m.div>
    </m.div>
  );
}
