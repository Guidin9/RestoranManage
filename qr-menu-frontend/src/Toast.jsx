import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, useMotionValue } from 'motion/react';
import { fadeOut, RESPONSE, rubberband, springDefault, springTo } from './motion';
import { ToastContext } from './useToast';

/* =========================================================================
   Toast yığını — window.alert() yerine.

   Dört tür: status (bilgi), ok (tamamlandı), warn (uyarı), error (hata).
   Geri bildirim ne kadar anlamlıysa o kadar değerli; her şeye toast
   çıkarmak kullanıcıyı hepsini görmezden gelmeye alıştırır.

   Yukarı kaydırarak kapatılır. Motion'ın drag prop'u yerine ham Pointer
   Events: drag, domMax özellik paketini zorunlu kılıyor ve bu paket
   müşteri QR rotasına iniyor.
   ========================================================================= */

const AUTO_DISMISS = 4000;
const DISMISS_DISTANCE = -28;   // px
const DISMISS_VELOCITY = -420;  // px/s

function ToastItem({ toast, onDismiss }) {
  const y = useMotionValue(0);
  const gesture = useRef(null);

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, y: event.clientY, t: performance.now() };
  };

  const handlePointerMove = (event) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const delta = event.clientY - start.y;
    // Yukarı serbest, aşağı dirençli: kapatma yönü yukarı
    y.set(delta < 0 ? delta : rubberband(delta, 120));
  };

  const endGesture = (event) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;

    const delta = event.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.t);
    const velocity = (delta / elapsed) * 1000;

    if (delta < DISMISS_DISTANCE || velocity < DISMISS_VELOCITY) onDismiss();
    else springTo(y, 0, { response: RESPONSE.default, bounce: 0, velocity });
  };

  return (
    <m.div
      className={`toast toast--${toast.kind}`}
      style={{ y }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ opacity: fadeOut, scale: springDefault }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      <span className="toast-dot" />
      <span className="toast-text">{toast.text}</span>
    </m.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (text, kind) => {
      if (!text) return;
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, text, kind }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS),
      );
    },
    [dismiss],
  );

  // Kapanırken sarkan zamanlayıcı kalmasın
  const timersRef = timers;
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [timersRef]);

  const api = useMemo(
    () => ({
      status: (text) => push(text, 'status'),
      ok: (text) => push(text, 'ok'),
      warn: (text) => push(text, 'warn'),
      error: (text) => push(text, 'error'),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
