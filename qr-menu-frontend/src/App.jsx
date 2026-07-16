import { useState, useEffect } from 'react'
import Cashier from './Cashier';
import Waiter from './Waiter';
import Admin from './Admin';
import { apiFetch } from './api';

function App() {
    // DİREKT LINK KONTROLLERİ
    const isCashierRoute = window.location.pathname === '/cashier';
    const isWaiterRoute = window.location.pathname === '/waiter';

    const [menu, setMenu] = useState([]);
    const [cart, setCart] = useState([]);

    // DİNAMİK ALANLARIMIZ
    const [tableNumber, setTableNumber] = useState('Yükleniyor...');
    const [tableId, setTableId] = useState(null);
    const [error, setError] = useState(null);
    const isAdminRoute = window.location.pathname === '/admin';

    // URL'deki (?table=uuid) parametresini yakalama
    const urlParams = new URLSearchParams(window.location.search);
    const tableUuid = urlParams.get('table');

    useEffect(() => {
        // Kasa VEYA Garson adresi açıldıysa müşteri QR kontrolü çalıştırma
        if (isCashierRoute || isWaiterRoute) return;

        if (!tableUuid) {
            setError("Lütfen masadaki QR kodu tekrar okutunuz. (Masa parametresi bulunamadı)");
            return;
        }

        apiFetch(`/api/menu/${tableUuid}`)
            .then(res => {
                if (res.success) {
                    setMenu(res.data);
                    setTableNumber(res.table_number);
                    setTableId(res.table_id);
                } else {
                    setError("Hatalı veya geçersiz bir QR kod okuttunuz!");
                }
            })
            .catch(() => {
                setError("Hatalı veya geçersiz bir QR kod okuttunuz!");
            });
    }, [tableUuid, isCashierRoute, isWaiterRoute]);

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
                    alert(res.message);
                    setCart([]);
                } else {
                    alert("Sipariş esnasında bir hata oluştu.");
                }
            })
            .catch(() => {
                alert("Sunucuya bağlanılamadı.");
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
    if (isAdminRoute) {
        return <Admin />;
    }

    // 🔴 3. SENARYO: QR Kod Yoksa veya Geçersizse Hata Göster
    if (error) {
        return (
            <div className="login-wrap">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <span className="login-emoji">⚠️</span>
                    <h2>Bir sorun var</h2>
                    <p className="muted" style={{ marginTop: 10 }}>{error}</p>
                </div>
            </div>
        );
    }

    // 🟢 4. SENARYO: Normal Müşteri QR Menü Ekranı
    return (
        <div className="page page--narrow">
            <div className="topbar">
                <h1 className="title-gradient">Mert'in QR Menü</h1>
                <span className="badge badge-accent">🍽️ {tableNumber}</span>
            </div>

            {menu.map((category, ci) => (
                <div key={category.id} className="card cat-block reveal" style={{ '--i': ci }}>
                    <h3 className="cat-title">{category.name}</h3>
                    <ul className="prod-list">
                        {category.products.map((product) => {
                            const qty = getItemQuantity(product.id);
                            return (
                                <li key={product.id} className="prod-row">
                                    <div className="prod-left">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="prod-thumb" />
                                        ) : (
                                            <div className="prod-thumb prod-thumb--empty">🍔</div>
                                        )}
                                        <div>
                                            <span className="prod-name">{product.name}</span>
                                            <span className="prod-price">{product.price} TL</span>
                                        </div>
                                    </div>

                                    <div className="stepper">
                                        {qty > 0 && (
                                            <>
                                                <button onClick={() => removeFromCart(product.id)} className="qty-btn">−</button>
                                                <span className="qty-num">{qty}</span>
                                            </>
                                        )}
                                        <button onClick={() => addToCart(product)} className="btn btn-primary btn-sm">+ Ekle</button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}

            {cart.length > 0 && (
                <div className="cart-bar">
                    <div className="row-between">
                        <h3 style={{ margin: 0 }}>🛒 Sepetiniz</h3>
                        <span className="badge badge-accent">{cart.reduce((n, i) => n + i.quantity, 0)} ürün</span>
                    </div>
                    <ul className="cart-list">
                        {cart.map(item => (
                            <li key={item.id}>
                                <span>{item.name} × {item.quantity}</span>
                                <span>{(item.price * item.quantity).toFixed(2)} TL</span>
                            </li>
                        ))}
                    </ul>
                    <div className="row-between">
                        <span className="cart-total">Toplam: {calculateTotal()} TL</span>
                        <button onClick={submitOrder} className="btn btn-success">Sepeti Onayla ✓</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App