import { useEffect } from 'react';

/* =========================================================================
   Modal erişilebilirliği: Escape, odak tuzağı, odağı geri verme ve
   iOS-güvenli kaydırma kilidi.

   "Kullanıcıyı asla kapana kıstırma" ilkesi: her diyalogdan Escape ile,
   backdrop tıklamasıyla ve görünür bir butonla çıkılabilmeli.
   ========================================================================= */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const visibleFocusables = (root) =>
  Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  );

export function useModalA11y(isOpen, onClose, containerRef) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const { body } = document;
    const scrollY = window.scrollY;

    // iOS Safari body { overflow: hidden }'ı YOK SAYAR. Tek çalışan yol
    // gövdeyi sabitleyip kaydırma konumunu telafi etmek; kapanışta da
    // konumu geri vermek, yoksa sayfa başa zıplar.
    const previousStyle = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const root = containerRef.current;
      if (!root) return;
      const items = visibleFocusables(root);
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!root.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    // Odağı ÖNCE kabın kendisine al (senkron): böylece klavye kullanıcısı
    // diyalog açılır açılmaz içeride olur ve Escape/Tab tuzağı hemen işler.
    // Sonra bir frame bekleyip ilk gerçek kontrole geç — o sırada Motion
    // elemanı yerleştirmiş, ölçülebilir hâle gelmiş olur.
    containerRef.current?.focus();
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root || !root.contains(document.activeElement)) return;
      visibleFocusables(root)[0]?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);

      body.style.position = previousStyle.position;
      body.style.top = previousStyle.top;
      body.style.width = previousStyle.width;
      body.style.overflow = previousStyle.overflow;
      window.scrollTo(0, scrollY);

      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose, containerRef]);
}
