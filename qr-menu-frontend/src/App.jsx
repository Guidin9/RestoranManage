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
import { fadeOut, springDefault } from './motion';

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
            <header className="menu-head">
                <div>
                    <div className="menu-eyebrow">Hoş Geldiniz</div>
                    <div className="menu-brand">Mert'in QR Menü</div>
                </div>
                <div className="menu-arch">
                    <div className="menu-arch-shape">
                        {tableNumber ?? <span className="skel" aria-label="Masa numarası yükleniyor" />}
                    </div>
                    <div className="menu-arch-label">Masa</div>
                </div>
            </header>

            {tableTotal > 0 && (
                <div className="tab-panel">
                    <div className="tab-total">
                        <span className="tab-total-label">Masa Hesabı</span>
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
                                        {it.stage === 'served' ? (
                                            <span className="status-tag status-tag--ok">Servis edildi</span>
                                        ) : it.stage === 'ready' ? (
                                            <span className="status-tag status-tag--ready">Servise hazır</span>
                                        ) : (
                                            <span className="status-tag status-tag--wait">Hazırlanıyor</span>
                                        )}
                                        <span className="tab-item-price">{it.line_total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺</span>
                                    </m.li>
                                ))}
                            </AnimatePresence>
                        </ul>
                    )}
                </div>
            )}

            {menu.map((category, ci) => (
                <section key={category.id} className="reveal" style={{ '--i': ci }}>
                    <h3 className="cat-title">{category.name}</h3>
                    {category.products.map((product) => {
                        const qty = getItemQuantity(product.id);
                        return (
                            <div key={product.id} className="prod-card">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="prod-thumb" />
                                ) : (
                                    <div className="prod-thumb prod-thumb--empty"><span>foto</span></div>
                                )}
                                <div className="prod-body">
                                    <div className="prod-name">{product.name}</div>
                                    <div className="prod-foot">
                                        <span className="prod-price">{product.price} ₺</span>
                                        {qty > 0 ? (
                                            <div className="stepper">
                                                <button onClick={() => removeFromCart(product.id)} className="qty-btn" aria-label={`${product.name} adedini azalt`}><IconMinus size={ICON.sm} /></button>
                                                <span className="qty-num">{qty}</span>
                                                <button onClick={() => addToCart(product)} className="qty-btn qty-btn--inc" aria-label={`${product.name} adedini artır`}><IconPlus size={ICON.sm} /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => addToCart(product)} className="btn btn-success btn-sm"><IconPlus size={ICON.xs} />Ekle</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                <div className="confirm-icon"><IconCheck size={ICON.xl} sw={2.4} /></div>
                <div className="confirm-title" id="confirm-title">Siparişiniz alındı</div>
                <div className="confirm-sub">Garsonumuz masanıza getiriyor. Afiyet olsun!</div>
                <button onClick={() => setOrderConfirmed(false)} className="btn btn-ink btn-block mt-5">Menüye Dön</button>
            </Modal>
        </div>
    )
}

export default App
