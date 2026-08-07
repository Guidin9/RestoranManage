/* =========================================================================
   "İçerik kabuğun altına girdi mi?" — yapışkan .app-nav'ın materyali ve
   saç teli ayıracı bu cevaba göre beliriyor (scroll edge effect).

   Scroll dinleyicisi + rAF throttle yerine IntersectionObserver: kaydırma
   başına hiçbir iş yapmıyor ve ana iş parçacığında ölçüm tetiklemiyor.
   ========================================================================= */

import { useEffect, useRef, useState } from 'react';

const FALLBACK = 96;

/**
 * @param {unknown} [deps] Kabuğun yüksekliği değişebiliyorsa (ör. sekme şeridi
 *   sonradan basılıyorsa) buraya onu temsil eden bir değer verin; eşik o yeni
 *   yüksekliğe göre yeniden kurulur.
 * @returns {{ scrolled: boolean, navRef: React.RefObject, sentinelRef: React.RefObject }}
 *   navRef -> .app-nav, sentinelRef -> kabuğun hemen altındaki sıfır
 *   yükseklikli işaret.
 */
export function useScrolled(deps = null) {
    const [scrolled, setScrolled] = useState(false);
    const navRef = useRef(null);
    const sentinelRef = useRef(null);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return undefined;

        // Çentikli telefonda kabuk safe-area kadar uzuyor; sabit bir px yanlış
        // olurdu, gerçek yükseklik ölçülüyor.
        const chrome = navRef.current?.offsetHeight || FALLBACK;
        const io = new IntersectionObserver(
            ([entry]) => setScrolled(!entry.isIntersecting),
            { rootMargin: `-${chrome}px 0px 0px 0px` },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [deps]);

    return { scrolled, navRef, sentinelRef };
}
