import { useCallback, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { clamp, fadeOut, springDefault } from './motion';
import { useModalA11y } from './useModalA11y';

/* =========================================================================
   Ortak modal kabuğu.

   - Giriş/çıkış AnimatePresence ile: daha önce çıkış animasyonu YOKTU,
     katman anında yok oluyordu.
   - "Materyalleş, sadece solma": kart opacity ile birlikte scale
     0.96 → 1 yapar, yüzey gelen gerçek bir malzeme gibi okunur.
     backdrop-filter'ın blur yarıçapı BİLEREK animasyona sokulmuyor —
     frame başına tam katman repaint'i, orta seviye Android'de takılır.
   - Çıkış girişin aynadaki hâli (aynı yol, ters yön).
   - originRef verilirse kart, kendisini açan elemandan büyür: buton ile
     içerik arasındaki mekânsal ilişki görünür kalır.
   ========================================================================= */

export function Modal({
  open,
  onClose,
  labelledBy,
  overlayClassName = 'modal-overlay',
  className = 'modal',
  originRef,
  children,
}) {
  const cardRef = useRef(null);
  useModalA11y(open, onClose, cardRef);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const trigger = originRef?.current;
    if (!open || !card || !trigger) return;

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    if (!c.width || !c.height) return;

    const x = ((t.left + t.width / 2 - c.left) / c.width) * 100;
    const y = ((t.top + t.height / 2 - c.top) / c.height) * 100;
    card.style.transformOrigin = `${clamp(x, -40, 140)}% ${clamp(y, -40, 140)}%`;
  }, [open, originRef]);

  const handleOverlayClick = useCallback(() => onClose(), [onClose]);
  const stop = useCallback((event) => event.stopPropagation(), []);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className={overlayClassName}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          // Emniyet: çıkış başlar başlamaz tıklamaları geçir. Bu ekranı
          // kaplayan bir katman; çıkış bir şekilde tamamlanmazsa görünmez
          // hâlde takılıp bütün sayfayı tıklanamaz yapardı.
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={fadeOut}
        >
          <m.div
            ref={cardRef}
            className={className}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            onClick={stop}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ opacity: fadeOut, scale: springDefault }}
          >
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
