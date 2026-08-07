import { useState, useEffect } from 'react'
import { AnimatePresence, m } from 'motion/react';
import Cashier from './Cashier';
import Waiter from './Waiter';
import Admin from './Admin';
import Kitchen from './Kitchen';
import { apiFetch } from './api';
import { IconPlus, IconMinus, IconCheck } from './icons';
import { ICON } from './iconScale';
import { CartSheet } from './CartSheet';
import { Modal } from './Modal';
import { useToast } from './useToast';
import { useMenuNav } from './useMenuNav';
import { fadeOut, springDefault, springSnappy, springSheet } from './motion';

const sectionId = (categoryId) => `cat-${categoryId}`;

function App() {
    const toast = useToast();
    // DİREKT LINK KONTROLLERİ
    const isCashierRoute = window.location.pathname === '/cashier';
    const isWaiterRoute = window.location.pathname === '/waiter';
    const isKitchenRoute = window.location.pathname === '/kitchen';

    const [menu, setMenu] = useState([]);
    const [cart, setCart] = useState([]);
    const [orderConfirmed, setOrderConfirmed] = useState(false);

    // DİNAMİK ALANLARIMIZ
    // null = henüz yüklenmedi. Eskiden burada 'Yükleniyor...' metni vardı ve
    // kemer motifini ~200ms boyunca deforme ediyordu; artık iskelet gösteriliyor.
    const [tableNumber, setTableNumber] = useState(null);
    const [tableId, setTableId] = useState(null);
    const [tableTotal, setTableTotal] = useState(0);      // masanın açık adisyon toplamı (herkesin siparişi)
    const [tableItems, setTableItems] = useState([]);     // masaya sipariş edilen ürünler (teslim durumuyla)
    const [error, setError] = useState(null);
    const isAdminRoute = window.location.pathname === '/admin';

    // URL'deki (?table=uuid) parametresini yakalama
    const urlParams = new URLSearchParams(window.location.search);
    const tableUuid = urlParams.get('table');

    useEffect(() => {
        // Kasa / Garson / Mutfak adresi açıldıysa müşteri QR kontrolü çalıştırma
        if (isCashierRoute || isWaiterRoute || isKitchenRoute) return;

        if (!tableUuid) {
            setError("Lütfen masadaki QR kodu tekrar okutunuz. (Masa parametresi bulunamadı)");
            return;
        }

        const fetchMenu = () => {
            apiFetch(`/api/menu/${tableUuid}`)
                .then(res => {
                    if (res.success) {
                        setMenu(res.data);
                        setTableNumber(res.table_number);
                        setTableId(res.table_id);
                        setTableTotal(res.active_order_total || 0);
                        setTableItems(res.active_order_items || []);
                    } else {
                        setError("Hatalı veya geçersiz bir QR kod okuttunuz!");
                    }
                })
                .catch(() => {
                    setError("Hatalı veya geçersiz bir QR kod okuttunuz!");
                });
        };

        fetchMenu();
        // Masa hesabı canlı kalsın: diğer kişiler/garson sipariş ekledikçe toplam güncellensin.
        const interval = setInterval(fetchMenu, 5000);
        return () => clearInterval(interval);
    }, [tableUuid, isCashierRoute, isWaiterRoute, isKitchenRoute]);

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === productId);
            if (existingItem && existingItem.quantity > 1) {
                return prevCart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
            }
            return prevCart.filter(item => item.id !== productId);
        });
    };

    const getItemQuantity = (productId) => {
        const item = cart.find(i => i.id === productId);
        return item ? item.quantity : 0;
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
    };

    const submitOrder = () => {
        const orderData = {
            table_id: tableId,
            items: cart.map(item => ({
                id: item.id,
                quantity: item.quantity
            }))
        };

        apiFetch('/api/orders', { method: 'POST', body: orderData })
            .then(res => {
                if (res.success) {
                    setCart([]);
                    setOrderConfirmed(true);
                } else {
                    toast.error("Sipariş esnasında bir hata oluştu.");
                }
            })
            .catch(() => {
                toast.error("Sunucuya bağlanılamadı.");
            });
    };

    // Yapışkan kabuk (küçülen başlık + kategori şeridi). Erken return'lerden
    // ÖNCE çağrılmalı — hook sırası her render'da aynı kalmak zorunda.
    const { activeId, collapsed, navRef, sentinelRef, stripRef, scrollToSection } =
        useMenuNav(menu.map((category) => sectionId(category.id)));

    // 🔴 1. SENARYO: "/cashier" adresi açıldıysa Kasa Ekranını göster
    if (isCashierRoute) {
        return <Cashier />;
    }

    // 🔴 2. SENARYO: "/waiter" adresi açıldıysa Garson Ekranını göster
    if (isWaiterRoute) {
        return <Waiter />;
    }
    if (isKitchenRoute) {
        return <Kitchen />;
    }
    if (isAdminRoute) {
        return <Admin />;
    }

    // 🔴 3. SENARYO: QR Kod Yoksa veya Geçersizse Hata Göster
    if (error) {
        return (
            <div className="login-wrap">
                <div className="login-card">
                    <div className="login-head">
                        <div className="login-arch">!</div>
                        <h2>Bir sorun var</h2>
                        <p className="login-sub">Menüye ulaşılamadı</p>
                    </div>
                    <div className="login-body text-center">
                        <p className="muted text-[13px]">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    // 🟢 4. SENARYO: Normal Müşteri QR Menü Ekranı
    return (
        <div className="menu-page">
            {/* Yapışkan kabuk. Akışın EN BAŞINDA duruyor: önce yer kaplar, sonra
                yapışır — böylece içerik altından kayar ve sayfaya elle üst
                padding vermek gerekmez. Materyal ve saç teli ayıraç yalnızca
                içerik altına girdiğinde belirir (scroll edge effect). */}
            <div ref={navRef} className={`app-nav app-nav--reveal${collapsed ? ' is-collapsed' : ''}`}>
                <div className="app-nav-row">
                    <span className="app-nav-title" aria-hidden="true">QR Menü</span>
                    <span className="table-chip">
                        Masa {tableNumber ?? <span className="skel" aria-label="Masa numarası yükleniyor" />}
                    </span>
                </div>

                {menu.length > 0 && (
                    <nav className="cat-bar" ref={stripRef} aria-label="Kategoriler">
                        {menu.map((category) => {
                            const id = sectionId(category.id);
                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    data-cat={id}
                                    className={`cat-pill${activeId === id ? ' is-active' : ''}`}
                                    aria-current={activeId === id ? 'true' : undefined}
                                    onClick={() => scrollToSection(id)}
                                >
                                    {category.name}
                                </button>
                            );
                        })}
                    </nav>
                )}
            </div>

            <header className="menu-hero">
                <div className="menu-eyebrow">Hoş Geldiniz</div>
                <h1 className="menu-brand">QR Menü</h1>
            </header>
            {/* Kompakt başlığın ne zaman geleceğini bu boş eleman belirler */}
            <div ref={sentinelRef} className="menu-sentinel" aria-hidden="true" />

            {tableTotal > 0 && (
                <section className="menu-section">
                    <h2 className="section-label">Masa Hesabı</h2>
                    <div className="group-card">
                        <div className="tab-total-row">
                            <span className="tab-total-label">Toplam</span>
                            <span className="tab-total-value">{tableTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                        </div>
                        {tableItems.length > 0 && (
                            // 5sn'lik poll bu listeyi baştan yazıyor; layout animasyonu
                            // olmadan satırlar kullanıcının gözü önünde ışınlanıyordu.
                            <ul className="tab-items">
                                <AnimatePresence initial={false}>
                                    {tableItems.map((it, i) => (
                                        <m.li
                                            key={`${it.name}-${i}`}
                                            className="tab-item"
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{ opacity: fadeOut, y: springDefault }}
                                        >
                                            <span className="tab-item-qty">{it.quantity}×</span>
                                            <span className="tab-item-name">{it.name}</span>
                                            {/* Aşama değişimi müşterinin beklediği tek
                                                sinyal; 5sn'lik poll'da sessizce takas
                                                olmasın. AnimatePresence YOK ve exit YOK:
                                                etiket bir an yok olsa satırdaki fiyat
                                                sağa sola sıçrardı. key değişimi aynı
                                                commit'te eskiyi söküp yenisini takar. */}
                                            <m.span
                                                key={it.stage}
                                                className={
                                                    it.stage === 'served' ? 'status-tag status-tag--ok'
                                                        : it.stage === 'ready' ? 'status-tag status-tag--ready'
                                                            : 'status-tag status-tag--wait'
                                                }
                                                initial={{ opacity: 0, y: -3 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ opacity: fadeOut, y: springSnappy }}
                                            >
                                                {it.stage === 'served' ? 'Servis edildi'
                                                    : it.stage === 'ready' ? 'Servise hazır'
                                                        : 'Hazırlanıyor'}
                                            </m.span>
                                            <span className="tab-item-price">{it.line_total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                                        </m.li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                        )}
                    </div>
                </section>
            )}

            {/* Menü henüz gelmediyse boş sayfa yerine içerik biçimli iskelet */}
            {menu.length === 0 && (
                <section className="menu-section" aria-hidden="true">
                    <div className="section-label"><span className="skel w-24" /></div>
                    <div className="group-card">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="menu-row">
                                <div className="skel-tile" />
                                <div className="row-body">
                                    <span className="skel skel-line" />
                                    <span className="skel w-14 mt-2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {menu.map((category, ci) => (
                <section
                    key={category.id}
                    id={sectionId(category.id)}
                    className="menu-section reveal"
                    style={{ '--i': ci }}
                >
                    <h2 className="section-label">{category.name}</h2>
                    <div className="group-card">
                        {category.products.map((product) => {
                            const qty = getItemQuantity(product.id);
                            return (
                                <div key={product.id} className="menu-row">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt="" className="row-thumb" loading="lazy" />
                                    ) : (
                                        // Fotoğrafsız ürün: "foto" yazan gri kutu yerine ürünün
                                        // baş harfi. Hizayı bozmadan boşluğu kasıtlı gösterir.
                                        <div className="row-mono" aria-hidden="true">{product.name.trim().charAt(0).toLocaleUpperCase('tr-TR')}</div>
                                    )}
                                    <div className="row-body">
                                        <div className="row-name">{product.name}</div>
                                        <div className="row-price">{product.price} ₺</div>
                                    </div>
                                    {qty > 0 ? (
                                        <div className="stepper">
                                            <button onClick={() => removeFromCart(product.id)} className="qty-btn" aria-label={`${product.name} adedini azalt`}><IconMinus size={ICON.sm} /></button>
                                            <span className="qty-num">{qty}</span>
                                            <button onClick={() => addToCart(product)} className="qty-btn qty-btn--inc" aria-label={`${product.name} adedini artır`}><IconPlus size={ICON.sm} /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => addToCart(product)} className="row-add" aria-label={`${product.name} ekle`}><IconPlus size={ICON.sm} /></button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            <AnimatePresence>
                {cart.length > 0 && (
                    <CartSheet cart={cart} total={calculateTotal()} onSubmit={submitOrder} />
                )}
            </AnimatePresence>

            <Modal
                open={orderConfirmed}
                onClose={() => setOrderConfirmed(false)}
                labelledBy="confirm-title"
                overlayClassName="confirm-overlay"
                className="confirm-card"
            >
                {/* Öğün başına bir kez görülen keyif anı: springSheet'in bounce 0.2'si
                    için motion.js'teki "jest yoksa bounce 0" kuralına BİLİNÇLİ
                    istisna. Kart oturmaya başladıktan 60ms sonra girer, yoksa iki
                    ölçek üst üste biner ve tik sıradan bir eleman gibi okunur. */}
                <m.div
                    className="confirm-icon"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        scale: { ...springSheet, delay: 0.06 },
                        opacity: { ...fadeOut, delay: 0.06 },
                    }}
                >
                    <IconCheck size={ICON.xl} sw={2.4} />
                </m.div>
                <div className="confirm-title" id="confirm-title">Siparişiniz alındı</div>
                <div className="confirm-sub">Garsonumuz masanıza getiriyor. Afiyet olsun!</div>
                <button onClick={() => setOrderConfirmed(false)} className="btn btn-ink btn-block mt-5">Menüye Dön</button>
            </Modal>
        </div>
    )
}

export default App
