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
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', color: 'red' }}>
                <h2>⚠️ Hata</h2>
                <p>{error}</p>
            </div>
        );
    }

    // 🟢 4. SENARYO: Normal Müşteri QR Menü Ekranı
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Mert'in QR Menü Sistemi</h1>
                <span style={{ backgroundColor: '#eee', padding: '5px 10px', borderRadius: '5px', fontWeight: 'bold' }}>
                    {tableNumber}
                </span>
            </div>
            <hr />

            <h2>Menü</h2>
            {menu.map((category) => (
                <div key={category.id} style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
                    <h3 style={{ color: 'orange', marginTop: 0 }}>{category.name}</h3>
                    <ul style={{ listStyleType: 'none', padding: 0 }}>
                        {category.products.map((product) => {
                            const qty = getItemQuantity(product.id);
                            return (
                                <li key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '15px 0', borderBottom: '1px solid #f0f0f0', paddingBottom: '10px' }}>

                                    {/* SOL KISIM: RESİM VE BİLGİ */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                style={{ width: '65px', height: '65px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                                            />
                                        ) : (
                                            <div style={{ width: '65px', height: '65px', backgroundColor: '#f0f0f0', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>
                                                🍔
                                            </div>
                                        )}
                                        <div>
                                            <strong style={{ fontSize: '16px', display: 'block' }}>{product.name}</strong>
                                            <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '14px' }}>{product.price} TL</span>
                                        </div>
                                    </div>

                                    {/* SAĞ KISIM: EKLE / ÇIKAR BUTONLARI */}
                                    <div>
                                        {qty > 0 && (
                                            <>
                                                <button onClick={() => removeFromCart(product.id)} style={{ padding: '5px 10px', cursor: 'pointer' }}>-</button>
                                                <span style={{ margin: '0 10px', fontWeight: 'bold' }}>{qty}</span>
                                            </>
                                        )}
                                        <button onClick={() => addToCart(product)} style={{ padding: '6px 12px', backgroundColor: 'orange', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            + Ekle
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}

            {cart.length > 0 && (
                <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeeba' }}>
                    <h3>Sepetiniz</h3>
                    <ul>
                        {cart.map(item => (
                            <li key={item.id}>
                                {item.name} x {item.quantity} = {(item.price * item.quantity).toFixed(2)} TL
                            </li>
                        ))}
                    </ul>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                        <h4>Toplam Tutar: {calculateTotal()} TL</h4>
                        <button onClick={submitOrder} style={{ padding: '10px 20px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' }}>
                            Sepeti Onayla
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App