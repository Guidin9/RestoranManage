import { useState, useEffect } from 'react';
import { apiFetch, UnauthorizedError } from './api';
import { IconCard, IconCloche } from './icons';

// tr-TR para & sayı biçimi
const money = (n) => (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
const moneyShort = (n) => {
    const v = Number(n) || 0;
    if (v >= 1000) return (v / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + 'B ₺';
    return Math.round(v).toLocaleString('tr-TR') + ' ₺';
};
const num = (n) => (Number(n) || 0).toLocaleString('tr-TR');

// Yerel bugünün YYYY-MM-DD hâli (UTC kaymasız)
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shortDay = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return String(d.getDate());
};
const longDay = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

// Üstü yuvarlatılmış dikey çubuk (tabana yaslı) — SVG path
const barTop = (x, y, w, h, r) => {
    const rr = Math.max(0, Math.min(r, w / 2, h));
    return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
};

/* Grafik renkleri artık BURADA DEĞİL, index.css'te @layer components içinde
   (.chart-axis / .chart-label / .chart-bar / .chart-tick).

   Eski yorum yarı doğruydu: SVG **presentation attribute**'ları (fill="…")
   var() çözmez — ama fill/stroke SVG'de aynı zamanda birer **CSS
   property**'sidir ve CSS'ten yazıldığında var() gayet çözülür. Sabit hex
   tutmanın tek sonucu grafiklerin karanlık modu takip etmemesiydi. */

// --- Son 14 gün ciro trendi (dikey çubuk) --------------------------------
function TrendChart({ trend }) {
    const W = 680, H = 200, padL = 12, padR = 12, padT = 26, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const baseY = padT + plotH;
    const slot = plotW / trend.length;
    const barW = slot * 0.6;
    const max = Math.max(...trend.map(t => t.revenue), 1);
    const selectedIdx = trend.length - 1; // trend seçili günle biter

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="img"
            aria-label="Son 14 günün günlük ciro trendi">
            {/* üst referans çizgisi + max etiketi */}
            <line x1={padL} y1={padT} x2={W - padR} y2={padT} className="chart-axis" strokeWidth="1" />
            <text x={padL} y={padT - 8} fontSize="11" className="chart-label">{moneyShort(max)}</text>

            {trend.map((t, i) => {
                const h = (t.revenue / max) * plotH;
                const x = padL + i * slot + (slot - barW) / 2;
                const y = baseY - h;
                const isSel = i === selectedIdx;
                return (
                    <g key={t.date}>
                        {/* Tek ton, tek iş: ciro hep --accent. Seçili gün ikinci
                            bir renkle değil, tam opaklıkla ayrışıyor. */}
                        <path d={barTop(x, y, barW, Math.max(h, 0.5), 4)}
                            className={`chart-bar${isSel ? ' is-sel' : ''}`}>
                            <title>{longDay(t.date)} — {money(t.revenue)} · {num(t.tables)} masa</title>
                        </path>
                        <text x={x + barW / 2} y={baseY + 14} fontSize="9.5" textAnchor="middle"
                            className={`chart-tick${isSel ? ' is-sel' : ''}`}>{shortDay(t.date)}</text>
                    </g>
                );
            })}
        </svg>
    );
}

// --- Günün çok satanları (yatay meter çubuk) -----------------------------
function TopProducts({ items }) {
    const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
    const max = Math.max(...sorted.map(p => p.revenue), 1);

    return (
        <div className="stack" style={{ gap: 11 }}>
            {sorted.map(p => (
                <div key={p.name} className="pbar-row">
                    <div className="pbar-head">
                        <span className="pbar-name">{p.name}</span>
                        <span className="pbar-value">{money(p.revenue)}</span>
                    </div>
                    <div className="pbar-track">
                        <div className="pbar-fill" style={{ width: `${(p.revenue / max) * 100}%` }}
                            title={`${p.name} — ${num(p.qty)} adet · ${money(p.revenue)}`} />
                    </div>
                    <span className="pbar-sub">{num(p.qty)} adet satıldı</span>
                </div>
            ))}
        </div>
    );
}

function CashierSummary({ onAuthError }) {
    const [date, setDate] = useState(todayStr());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        apiFetch(`/api/cashier/summary?date=${date}`, { role: 'cashier' })
            .then(res => {
                if (!active) return;
                if (res.success) setData(res);
                setLoading(false);
            })
            .catch(err => {
                if (err instanceof UnauthorizedError) { onAuthError?.(); return; }
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [date, onAuthError]);

    const kpis = data?.today;
    const hasSales = kpis && kpis.tables_closed > 0;

    // Kök .reveal kaldırıldı: sekme geçişi artık Cashier.jsx'te cross-fade yapıyor,
    // ikinci bir CSS fade üstüne binmesin.
    return (
        <div>
            {/* Tarih seçici */}
            <div className="summary-toolbar">
                <label className="label" style={{ margin: 0 }}>Tarih</label>
                <input type="date" className="input" style={{ width: 'auto' }} value={date}
                    max={todayStr()} onChange={e => setDate(e.target.value)} />
                <button className="btn btn-sm" onClick={() => setDate(todayStr())}>Bugün</button>
            </div>

            {loading ? (
                <div className="spinner" style={{ margin: '48px auto' }} />
            ) : (
                <>
                    {/* Günlük KPI kutuları */}
                    <div className="kpi-grid">
                        <div className="kpi kpi--accent">
                            <span className="kpi-label">Günlük Kazanç</span>
                            <span className="kpi-value">{money(kpis?.revenue)}</span>
                        </div>
                        <div className="kpi">
                            <span className="kpi-label">Kapanan Masa</span>
                            <span className="kpi-value">{num(kpis?.tables_closed)}</span>
                        </div>
                        <div className="kpi">
                            <span className="kpi-label">Satılan Ürün</span>
                            <span className="kpi-value">{num(kpis?.items_sold)}</span>
                        </div>
                        <div className="kpi">
                            <span className="kpi-label">Ortalama Masa</span>
                            <span className="kpi-value">{money(kpis?.avg_ticket)}</span>
                        </div>
                    </div>

                    {/* Haftalık / Aylık bağlam */}
                    <div className="context-grid">
                        <div className="ctx">
                            <span className="ctx-title">Bu Hafta</span>
                            <div className="ctx-row"><span>Toplam ciro</span><b>{money(data?.week?.revenue)}</b></div>
                            <div className="ctx-row"><span>Günlük ortalama</span><b>{money(data?.week?.avg_daily_revenue)}</b></div>
                            <div className="ctx-row"><span>Kapanan masa</span><b>{num(data?.week?.tables_closed)}</b></div>
                        </div>
                        <div className="ctx">
                            <span className="ctx-title">Bu Ay</span>
                            <div className="ctx-row"><span>Toplam ciro</span><b>{money(data?.month?.revenue)}</b></div>
                            <div className="ctx-row"><span>Günlük ortalama</span><b>{money(data?.month?.avg_daily_revenue)}</b></div>
                            <div className="ctx-row"><span>Kapanan masa</span><b>{num(data?.month?.tables_closed)}</b></div>
                        </div>
                    </div>

                    {/* Grafikler */}
                    <div className="chart-card">
                        <div className="chart-title"><IconCard size={15} />Son 14 Gün — Günlük Ciro</div>
                        {data?.daily_trend?.some(t => t.revenue > 0)
                            ? <TrendChart trend={data.daily_trend} />
                            : <div className="chart-empty">Bu aralıkta kayıtlı ciro yok.</div>}
                    </div>

                    <div className="chart-card">
                        <div className="chart-title"><IconCloche size={15} />Günün Çok Satanları</div>
                        {hasSales && data?.top_products?.length > 0
                            ? <TopProducts items={data.top_products} />
                            : <div className="chart-empty">Seçili günde satış kaydı yok.</div>}
                    </div>
                </>
            )}
        </div>
    );
}

export default CashierSummary;
