import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { apiFetch, getToken, setToken, clearToken, UnauthorizedError } from './api';
import { IconPlus, IconMinus, IconX, IconLogout, IconLogin, IconCalendar, IconCheck, IconBag, IconBell } from './icons';
import { ICON } from './iconScale';
import { useToast } from './useToast';
import { useScrolled } from './useScrolled';
import { Modal } from './Modal';
import { fadeOut, springDefault } from './motion';

function Waiter() {
    const toast = useToast();
    // Token yoksa kayıtlı garson bilgisi de anlamsız; ikisini birlikte değerlendiriyoruz.
    const [waiterInfo, setWaiterInfo] = useState(() => {
        const saved = localStorage.getItem('waiter_info');
        return saved && getToken('waiter') ? JSON.parse(saved) : null;
    });

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    // Veri State'leri
    const [tables, setTables] = useState([]);
    const [menu, setMenu] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);

    // Bekleyen sepet: garson ürünleri önce burada toplar, "Siparişi Gönder" ile
    // topluca yollar. { [productId]: { product, qty } }
    const [pendingCart, setPendingCart] = useState({});

    const { scrolled, navRef, sentinelRef } = useScrolled();

    /* Modal açıkken 3sn'lik poll setSelectedTable(updated) çağırıp adisyon
       satırlarını kullanıcının parmağının ALTINDA yeniden çiziyordu: "Eksilt"e
       basarken satır kayıyor ve yanlış ürün eksiliyordu.

       Veri akışına dokunmadan çözüm: dokunma başlar başlamaz bir bayrak
       kalkıyor, parmak kalktıktan 800ms sonra iniyor. Bayrak kalkıkken gelen
       yanıt tamponlanıyor (son hâli saklanıyor), bayrak inince uygulanıyor —
       yani veri bayatlamıyor, sadece etkileşim anında ekran sabit kalıyor. */
    const isInteracting = useRef(false);
    const bufferedTable = useRef(null);
    const releaseTimer = useRef(0);

    const holdUpdates = () => {
        isInteracting.current = true;
        clearTimeout(releaseTimer.current);
    };
    const releaseUpdates = () => {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = setTimeout(() => {
            isInteracting.current = false;
            if (bufferedTable.current) {
                setSelectedTable(bufferedTable.current);
                bufferedTable.current = null;
            }
        }, 800);
    };
    useEffect(() => () => clearTimeout(releaseTimer.current), []);

    /* Adisyon paneli hangi karttan açıldı? Modal ölçeğini bu elemanın merkezinden
       başlatıyor (Modal.jsx originRef), böylece panelin nereden geldiği görünüyor.
       Onay diyalogları bunu KULLANMAZ — onlar merkezden gelmeli. */
    const cardOriginRef = useRef(null);

    // 1. MANTIK: Garson Girişi
    const handleLogin = (e) => {
        e.preventDefault();
        setLoginError('');

        apiFetch('/api/waiter/login', { method: 'POST', body: { username, password } })
            .then(res => {
                if (res.success && res.token) {
                    setToken('waiter', res.token);
                    localStorage.setItem('waiter_info', JSON.stringify(res.waiter));
                    setWaiterInfo(res.waiter);
                    setPassword('');
                } else {
                    setLoginError(res.message || 'Giriş başarısız!');
                }
            })
            .catch(() => setLoginError('Sunucuya bağlanılamadı.'));
    };

    const handleLogout = () => {
        apiFetch('/api/logout', { role: 'waiter', method: 'POST' })
            .catch(() => { /* token zaten geçersizse sorun değil */ })
            .finally(() => {
                clearToken('waiter');
                localStorage.removeItem('waiter_info');
                setWaiterInfo(null);
            });
    };

    // Token geçersizse giriş ekranına düş.
    const handleAuthError = (err) => {
        if (err instanceof UnauthorizedError) {
            localStorage.removeItem('waiter_info');
            setWaiterInfo(null);
            return true;
        }
        return false;
    };

    // 2. MANTIK: Tüm Masaları ve Menüyü Yükleme
    const fetchAllData = () => {
        // Tüm masaları çek
        apiFetch('/api/waiter/tables', { role: 'waiter' })
            .then(res => {
                if (res.success) {
                    setTables(res.data);
                    // Eğer bir masa modalı açıksa, onun güncel halini de seçili tut
                    if (selectedTable) {
                        const updated = res.data.find(t => t.id === selectedTable.id);
                        if (updated) {
                            // Parmak ekrandayken satırları yeniden çizme; son
                            // hâli sakla, dokunma bitince uygula.
                            if (isInteracting.current) bufferedTable.current = updated;
                            else setSelectedTable(updated);
                        }
                    }
                }
            })
            .catch(handleAuthError);

        // Menüyü çek
        apiFetch('/api/waiter/menu', { role: 'waiter' })
            .then(res => {
                if (res.success) setMenu(res.data);
            })
            .catch(handleAuthError);
    };

    useEffect(() => {
        if (!waiterInfo) return;
        fetchAllData();
        const interval = setInterval(fetchAllData, 3000); // 3 saniyede bir masa durumlarını canlı yenile
        return () => clearInterval(interval);
    }, [waiterInfo, selectedTable?.id]);

    // Başka bir masaya geçince (ya da modal kapanınca) bekleyen sepeti sıfırla.
    useEffect(() => {
        setPendingCart({});
    }, [selectedTable?.id]);

    // 3. MANTIK: Bekleyen sepete ürün ekle / çıkar (henüz sunucuya gitmez).
    //    Aynı ürün tekrar seçilince yeni satır açmaz, adedini artırır.
    const addToPending = (product) => {
        setPendingCart(prev => {
            const existing = prev[product.id];
            return { ...prev, [product.id]: { product, qty: (existing?.qty || 0) + 1 } };
        });
    };

    const decFromPending = (productId) => {
        setPendingCart(prev => {
            const existing = prev[productId];
            if (!existing) return prev;
            if (existing.qty <= 1) {
                const next = { ...prev };
                delete next[productId];
                return next;
            }
            return { ...prev, [productId]: { ...existing, qty: existing.qty - 1 } };
        });
    };

    // Bekleyen sepeti tek partide masaya gönder (/api/orders herkese açık uç).
    // Backend aynı ürünleri mevcut adisyonla birleştirir.
    const submitPending = () => {
        const items = Object.values(pendingCart).map(({ product, qty }) => ({ id: product.id, quantity: qty }));
        if (items.length === 0) return;

        apiFetch('/api/orders', {
            method: 'POST',
            body: { table_id: selectedTable.id, items }
        })
            .then(res => {
                if (res.success) {
                    setPendingCart({});
                    fetchAllData();
                }
            })
            .catch(() => toast.error("Sipariş gönderilemedi, sunucuya ulaşılamıyor."));
    };

    // 4. MANTIK: Adisyondan Ürün Eksiltme / Silme
    const handleRemoveItem = (itemId) => {
        apiFetch(`/api/waiter/items/${itemId}/remove`, { role: 'waiter', method: 'POST' })
            .then(res => {
                if (res.success) fetchAllData();
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Ürün silinemedi, sunucuya ulaşılamıyor.");
            });
    };

    // 5. MANTIK: Servis işaretleme — mutfağın hazırladığı (ready) kalemleri servis et
    const handleServeItem = (itemId) => {
        apiFetch(`/api/waiter/items/${itemId}/serve`, { role: 'waiter', method: 'POST' })
            .then(res => {
                if (res.success) fetchAllData();
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Servis işaretlenemedi, sunucuya ulaşılamıyor.");
            });
    };

    const handleServeAll = (orderId) => {
        apiFetch(`/api/waiter/orders/${orderId}/serve`, { role: 'waiter', method: 'POST' })
            .then(res => {
                if (res.success) fetchAllData();
            })
            .catch(err => {
                if (!handleAuthError(err)) toast.error("Servis işaretlenemedi, sunucuya ulaşılamıyor.");
            });
    };

    // Servis bekleyen (mutfak hazırladı) kalem var mı? — kart / banner / modal için
    const tableHasReady = (t) => (t.active_order?.items || []).some(i => (i.ready_quantity || 0) > 0);
    const readyTableCount = tables.filter(tableHasReady).length;

    // Adisyon toplamı (yalnızca görünüm için)
    const orderItems = selectedTable?.active_order?.items || [];
    const orderTotal = orderItems.reduce((sum, item) => sum + item.price_at_sale * item.quantity, 0).toFixed(2);
    const selectedReadyCount = orderItems.reduce((n, i) => n + (i.ready_quantity || 0), 0);

    // Bekleyen sepet (henüz gönderilmemiş) toplamları
    const pendingLines = Object.values(pendingCart);
    const pendingCount = pendingLines.reduce((n, l) => n + l.qty, 0);
    const pendingTotal = pendingLines.reduce((s, l) => s + l.product.price * l.qty, 0).toFixed(2);

    // 🔴 EĞER GİRİŞ YAPILMADIYSA: LOGIN EKRANI
    if (!waiterInfo) {
        return (
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <div className="login-head">
                        <div className="login-arch">G</div>
                        <h2>Garson Girişi</h2>
                        <p className="login-sub">Masalarınızı yönetmek için giriş yapın</p>
                    </div>
                    <div className="login-body">
                        {loginError && <div className="alert">{loginError}</div>}
                        <div className="field">
                            <label className="label">Kullanıcı Adı</label>
                            <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required placeholder="kullanıcı adınız" />
                        </div>
                        <div className="field" style={{ marginBottom: 20 }}>
                            <label className="label">Şifre</label>
                            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                        </div>
                        <button type="submit" className="btn btn-success btn-block">Giriş Yap<IconLogin /></button>
                    </div>
                </form>
            </div>
        );
    }

    // 🟢 EĞER GİRİŞ YAPILDIYSA: FULL MASA HARİTASI
    return (
        <div className="page">
            {/* ÜST BAR */}
            <div ref={navRef} className={`app-nav${scrolled ? ' is-collapsed' : ''}`}>
                <div className="app-nav-row">
                    <div className="app-nav-main">
                        <div className="app-nav-title">Masalar</div>
                        <div className="app-nav-sub">{waiterInfo.name} · #{waiterInfo.id}</div>
                    </div>
                    <div className="app-nav-actions">
                        <span className="badge-live"><span className="dot-live" />Canlı</span>
                        <button onClick={handleLogout} className="btn btn-logout btn-sm"><IconLogout size={ICON.xs} />Çıkış</button>
                    </div>
                </div>
            </div>
            <div ref={sentinelRef} className="menu-sentinel" aria-hidden="true" />

            {/* TÜM MASALARIN LISTESİ (GRID) */}
            <div className="panel-body">
                {/* Durum bildiren uyarı: hiç hareket etmeden belirmesi
                    gözden kaçıyordu. Giriş ve çıkış aynı yoldan (yukarıdan),
                    böylece kaybolması da kendini haber ediyor. */}
                <AnimatePresence initial={false}>
                {readyTableCount > 0 && (
                    <m.div
                        className="alert-banner"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ opacity: fadeOut, y: springDefault }}
                    >
                        <IconBell size={ICON.md} />
                        <span><b>{readyTableCount} masada</b> servis bekleyen sipariş var</span>
                    </m.div>
                )}
                </AnimatePresence>
                {/* İlk yükleme: boş bir ızgara yerine içerik biçimli iskelet.
                    Diğer üç ekranla aynı davranış. */}
                {tables.length === 0 && (
                    <div className="grid grid-tables" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="table-card table-card--free">
                                <div className="row-between">
                                    <span className="skel w-20 h-5" />
                                </div>
                                <div className="table-meta"><span className="skel w-24" /></div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 3sn'lik poll: masa eklenip silindiğinde kartlar ışınlanmasın */}
                <div className="grid grid-tables">
                    <AnimatePresence initial={false}>
                        {tables.map((table) => {
                            const ready = tableHasReady(table);
                            return (
                                <m.button
                                    key={table.id}
                                    onClick={(event) => {
                                        // currentTarget: kartın kendisi. event.target
                                        // içteki <span> olabilir, modal yanlış
                                        // noktadan büyürdü.
                                        cardOriginRef.current = event.currentTarget;
                                        setSelectedTable(table);
                                    }}
                                    className={`table-card ${table.is_occupied ? 'table-card--busy' : 'table-card--free'} ${ready ? 'table-card--pending' : ''}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    transition={{ opacity: fadeOut, y: springDefault, scale: springDefault }}
                                >
                                    <div className="row-between">
                                        <span className="table-name">{table.table_number}</span>
                                        <span className={`table-status ${table.is_occupied ? 'table-status--busy' : 'table-status--free'}`}>
                                            {table.is_occupied ? 'DOLU' : 'BOŞ'}
                                        </span>
                                    </div>
                                    <div className="table-meta">
                                        {ready ? (
                                            <span className="badge-pending"><span className="dot-pending" />Servis bekliyor</span>
                                        ) : table.is_occupied
                                            ? `${table.active_order?.items?.length || 0} kalem ürün`
                                            : 'sipariş almak için dokunun'}
                                    </div>
                                </m.button>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* MASAYA TIKLANDIĞINDA AÇILAN SİPARİŞ / ADİSYON MODALI.
                El yapımı overlay yerine <Modal>: Escape, odak tuzağı, odağı
                geri verme, iOS-güvenli kaydırma kilidi ve çıkış animasyonu
                oradan geliyor (ASAMA-2 P1). */}
            <Modal
                open={!!selectedTable}
                onClose={() => setSelectedTable(null)}
                labelledBy="table-modal-title"
                originRef={cardOriginRef}
            >
                {selectedTable && (
                    <>
                        <div className="modal-head">
                            <span className="modal-title" id="table-modal-title">{selectedTable.table_number}</span>
                            <button onClick={() => setSelectedTable(null)} className="modal-close" aria-label="Kapat"><IconX size={ICON.md} /></button>
                        </div>

                        {/* Poll'un satırları parmağın altında değiştirmesini
                            engelleyen tampon burada devreye giriyor. */}
                        <div
                            className="modal-body"
                            onPointerDownCapture={holdUpdates}
                            onPointerUpCapture={releaseUpdates}
                            onPointerCancelCapture={releaseUpdates}
                        >

                            {/* BÖLÜM 1: MEVCUT ADİSYON & ÜRÜN SİLME */}
                            <h4 className="section-title"><IconCalendar />Masadaki Güncel Adisyon</h4>

                            {selectedTable.is_occupied && orderItems.length > 0 ? (
                                <div className="stack mb-[22px]" style={{ gap: 8 }}>
                                    <AnimatePresence initial={false}>
                                        {orderItems.map(item => (
                                            <m.div
                                                key={item.id}
                                                className={`line-row ${item.ready_quantity > 0 ? 'line-row--pending' : ''}`}
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -8 }}
                                                transition={{ opacity: fadeOut, x: springDefault }}
                                            >
                                                <span className="line-qty">{item.quantity}×</span>
                                                <span className="line-name">{item.product ? item.product.name : 'Ürün'}</span>
                                                {item.stage === 'served' ? (
                                                    <span className="status-tag status-tag--ok">Servis edildi</span>
                                                ) : item.stage === 'ready' ? (
                                                    <span className="status-tag status-tag--ready">Servise hazır</span>
                                                ) : (
                                                    <span className="status-tag status-tag--wait">Hazırlanıyor</span>
                                                )}
                                                <span className="line-price">{(item.price_at_sale * item.quantity).toFixed(2)} ₺</span>
                                                {item.ready_quantity > 0 ? (
                                                    <button onClick={() => handleServeItem(item.id)} className="btn btn-success btn-sm"><IconCheck size={ICON.xs} />Servis Et</button>
                                                ) : (
                                                    <button onClick={() => handleRemoveItem(item.id)} className="btn btn-danger btn-sm"><IconMinus size={ICON.xs} />Eksilt</button>
                                                )}
                                            </m.div>
                                        ))}
                                    </AnimatePresence>
                                    <div className="total-row"><span>Toplam</span><span>{orderTotal} ₺</span></div>
                                    {selectedReadyCount > 0 && (
                                        <button onClick={() => handleServeAll(selectedTable.active_order.id)} className="btn btn-success btn-block mt-1">
                                            <IconCheck size={ICON.sm} />Tümünü Servis Et ({selectedReadyCount} ürün)
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="hint-box mb-[22px]">Bu masada henüz ürün yok — aşağıdan ekleyin.</div>
                            )}

                            {/* BÖLÜM 2: MASAYA MENÜDEN ÜRÜN EKLEME (önce sepete toplanır) */}
                            <h4 className="section-title section-title--add"><IconPlus size={ICON.sm} />Masaya Ürün Ekle</h4>

                            {menu.map(category => (
                                <div key={category.id}>
                                    <div className="section-label">{category.name}</div>
                                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                                        {category.products.map(product => {
                                            const inCart = pendingCart[product.id]?.qty || 0;
                                            return (
                                                <div key={product.id} className="add-chip">
                                                    <div className="add-chip-body">
                                                        <div className="add-chip-name">{product.name}</div>
                                                        <div className="add-chip-price">{product.price} ₺</div>
                                                    </div>
                                                    {inCart > 0 ? (
                                                        <div className="stepper">
                                                            <button onClick={() => decFromPending(product.id)} className="qty-btn"><IconMinus size={ICON.xs} /></button>
                                                            <span className="qty-num">{inCart}</span>
                                                            <button onClick={() => addToPending(product)} className="qty-btn qty-btn--inc"><IconPlus size={ICON.xs} /></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => addToPending(product)} className="btn btn-success btn-sm"><IconPlus size={ICON.xs} />Ekle</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* BEKLEYEN SEPET — toplu gönderim */}
                            {pendingCount > 0 && (
                                <div className="pending-cart">
                                    <div className="pending-cart-head">
                                        <div className="cart-bag"><IconBag size={ICON.lg} /><span className="cart-count">{pendingCount}</span></div>
                                        <span className="pending-cart-title">Gönderilecek Sepet</span>
                                        <span className="pending-cart-total">{pendingTotal} ₺</span>
                                    </div>
                                    <div className="stack" style={{ gap: 7, margin: '12px 0' }}>
                                        {pendingLines.map(({ product, qty }) => (
                                            <div key={product.id} className="pending-line">
                                                <span className="pending-line-name">{product.name}</span>
                                                <div className="stepper">
                                                    <button onClick={() => decFromPending(product.id)} className="qty-btn"><IconMinus size={ICON.xs} /></button>
                                                    <span className="qty-num">{qty}</span>
                                                    <button onClick={() => addToPending(product)} className="qty-btn qty-btn--inc"><IconPlus size={ICON.xs} /></button>
                                                </div>
                                                <span className="pending-line-price">{(product.price * qty).toFixed(2)} ₺</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={submitPending} className="btn btn-success btn-block"><IconCheck size={ICON.sm} />Siparişi Gönder ({pendingTotal} ₺)</button>
                                </div>
                            )}

                            <button onClick={() => setSelectedTable(null)} className="btn btn-ink btn-block mt-3.5">Pencereyi Kapat</button>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
}

export default Waiter;
