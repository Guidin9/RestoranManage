/* =========================================================================
   Müşteri menüsünün yapışkan kabuğu: küçülen başlık + kategori şeridi.

   Tamamı IntersectionObserver ile. Scroll dinleyicisi + rAF throttle
   bilerek tercih EDİLMEDİ: kaydırma başına iş yapmadan aynı sonucu verir
   ve ana iş parçacığında hiçbir şey ölçmez.
   ========================================================================= */

import { useCallback, useEffect, useRef, useState } from 'react';

// Yapışkan kabuğun yüksekliği (nav 52 + kategori şeridi 44). index.css'teki
// .menu-section { scroll-margin-top } ile AYNI kalmalı — yoksa pill'e
// dokununca hedef bölümün başlığı kabuğun altında kalır.
const CHROME = 96;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const behavior = () => (reduced() ? 'auto' : 'smooth');

export function useMenuNav(sectionIds) {
    const [activeId, setActiveId] = useState(null);
    const [collapsed, setCollapsed] = useState(false);

    const sentinelRef = useRef(null);
    const stripRef = useRef(null);
    // Pill'e dokunulduğunda kaydırma sürerken observer aradaki her bölümü
    // sırayla aktif yapar ve şerit titrer. Kaydırma boyunca observer susar.
    const lockedUntil = useRef(0);

    // 1) Büyük başlık kabuğun altına girdi mi? Girdiyse kompakt başlık gelir.
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return undefined;

        const io = new IntersectionObserver(
            ([entry]) => setCollapsed(!entry.isIntersecting),
            { rootMargin: `-${CHROME}px 0px 0px 0px` },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // 2) Hangi kategori okunuyor? Kabuğun hemen altındaki dar bandı kesen
    //    bölümlerden DOM sırasında ilki aktiftir.
    const key = sectionIds.join('|');
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
            { rootMargin: `-${CHROME + 4}px 0px -60% 0px` },
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

    return { activeId, collapsed, sentinelRef, stripRef, scrollToSection };
}
