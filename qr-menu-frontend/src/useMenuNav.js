/* =========================================================================
   Müşteri menüsünün yapışkan kabuğu: küçülen başlık + kategori şeridi.

   Tamamı IntersectionObserver ile. Scroll dinleyicisi + rAF throttle
   bilerek tercih EDİLMEDİ: kaydırma başına iş yapmadan aynı sonucu verir
   ve ana iş parçacığında hiçbir şey ölçmez.
   ========================================================================= */

import { useCallback, useEffect, useRef, useState } from 'react';

// Kabuğun tahmini yüksekliği (nav 52 + kategori şeridi 44). Yalnızca ölçüm
// yapılamadığında kullanılan yedek: çentikli telefonda kabuk safe-area kadar
// daha uzun oluyor, o yüzden gerçek değer nav'ın offsetHeight'ından okunuyor.
const CHROME_FALLBACK = 96;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const behavior = () => (reduced() ? 'auto' : 'smooth');

export function useMenuNav(sectionIds) {
    const [activeId, setActiveId] = useState(null);
    const [collapsed, setCollapsed] = useState(false);

    const navRef = useRef(null);
    const sentinelRef = useRef(null);
    const stripRef = useRef(null);

    const chrome = () => navRef.current?.offsetHeight || CHROME_FALLBACK;
    // Pill'e dokunulduğunda kaydırma sürerken observer aradaki her bölümü
    // sırayla aktif yapar ve şerit titrer. Kaydırma boyunca observer susar.
    const lockedUntil = useRef(0);

    // 1) Büyük başlık kabuğun altına girdi mi? Girdiyse kompakt başlık gelir.
    //    key bağımlılıkta: menü gelince kategori şeridi de basılıyor ve kabuk
    //    uzuyor — observer'ın eşiği o yeni yüksekliğe göre kurulmalı.
    const key = sectionIds.join('|');
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return undefined;

        const io = new IntersectionObserver(
            ([entry]) => setCollapsed(!entry.isIntersecting),
            { rootMargin: `-${chrome()}px 0px 0px 0px` },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [key]);

    // 2) Hangi kategori okunuyor? Kabuğun hemen altındaki dar bandı kesen
    //    bölümlerden DOM sırasında ilki aktiftir.
    useEffect(() => {
        const ids = key ? key.split('|') : [];
        const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);
        if (nodes.length === 0) return undefined;

        setActiveId((current) => (ids.includes(current) ? current : ids[0]));

        const visible = new Set();
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                if (Date.now() < lockedUntil.current || visible.size === 0) return;
                // Sıra DOM'dan geliyor; getBoundingClientRect okumak burada
                // gereksiz bir layout tetiklerdi.
                const next = ids.find((id) => visible.has(id));
                if (next) setActiveId(next);
            },
            { rootMargin: `-${chrome() + 4}px 0px -60% 0px` },
        );
        nodes.forEach((node) => io.observe(node));
        return () => io.disconnect();
    }, [key]);

    // 3) Aktif pill her zaman şeridin ortasında dursun.
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip || !activeId) return;
        const pill = strip.querySelector(`[data-cat="${activeId}"]`);
        if (!pill) return;

        // scrollIntoView BURADA KULLANILAMAZ: yatay şeridi ortalarken dikey
        // olarak sayfayı da kaydırır. Şeridin kendi scrollLeft'i yan etkisiz.
        const strips = strip.getBoundingClientRect();
        const pills = pill.getBoundingClientRect();
        const delta = pills.left + pills.width / 2 - (strips.left + strips.width / 2);
        if (Math.abs(delta) < 2) return;
        strip.scrollTo({ left: strip.scrollLeft + delta, behavior: behavior() });
    }, [activeId]);

    const scrollToSection = useCallback((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        lockedUntil.current = Date.now() + 800;
        setActiveId(id);
        el.scrollIntoView({ behavior: behavior(), block: 'start' });
    }, []);

    return { activeId, collapsed, navRef, sentinelRef, stripRef, scrollToSection };
}
