import { useState, useEffect } from 'react';
import { apiFetch, getToken, setToken, clearToken, IMGBB_API_KEY, UnauthorizedError } from './api';

// QR kodu panelin açıldığı adresi hedefler; canlıda otomatik olarak doğru domain olur.
const menuUrlFor = (qrCode) => `${window.location.origin}/?table=${qrCode}`;

function Admin() {
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => !!getToken('admin'));

    const [activeTab, setActiveTab] = useState('waiters');

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Veri Listeleri
    const [waiters, setWaiters] = useState([]);
    const [tables, setTables] = useState([]);
    const [menu, setMenu] = useState([]);

    // Form State'leri
    const [newWaiter, setNewWaiter] = useState({ name: '', username: '', password: '' });
    const [newTableNumber, setNewTableNumber] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');

    const [newProduct, setNewProduct] = useState({ category_id: '', name: '', price: '' });
    const [imageFile, setImageFile] = useState(null);

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        apiFetch('/api/admin/login', { method: 'POST', body: { username, password } })
            .then(res => {
                if (res.success && res.token) {
                    setToken('admin', res.token);
                    setIsAdminLoggedIn(true);
                    setPassword('');
                } else {
                    setError(res.message || 'Giriş başarısız!');
                }
            })
            .catch(() => setError('Sunucuya bağlanılamadı.'));
    };

    const handleLogout = () => {
        apiFetch('/api/logout', { role: 'admin', method: 'POST' })
            .catch(() => { /* token zaten geçersizse sorun değil */ })
            .finally(() => {
                clearToken('admin');
                setIsAdminLoggedIn(false);
            });
    };

    // Token geçersizse giriş ekranına düş.
    const handleAuthError = (err) => {
        if (err instanceof UnauthorizedError) {
            setIsAdminLoggedIn(false);
            return true;
        }
        return false;
    };

    const loadAllData = () => {
        apiFetch('/api/admin/waiters', { role: 'admin' })
            .then(res => res.success && setWaiters(res.data))
            .catch(handleAuthError);

        apiFetch('/api/waiter/tables', { role: 'admin' })
            .then(res => res.success && setTables(res.data))
            .catch(handleAuthError);

        apiFetch('/api/waiter/menu', { role: 'admin' })
            .then(res => res.success && setMenu(res.data))
            .catch(handleAuthError);
    };

    useEffect(() => {
        if (isAdminLoggedIn) loadAllData();
    }, [isAdminLoggedIn]);

    // --- GARSON İŞLEMLERİ ---
    const addWaiter = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/waiters', { role: 'admin', method: 'POST', body: newWaiter })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewWaiter({ name: '', username: '', password: '' });
                    loadAllData();
                } else {
                    alert("⚠️ Hata: " + (res.message || "Garson eklenemedi."));
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Bağlantı hatası!");
            });
    };

    const deleteWaiter = (id) => {
        if (!window.confirm("Bu garsonu silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/waiters/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    // --- MASA İŞLEMLERİ ---
    const addTable = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/tables', { role: 'admin', method: 'POST', body: { table_number: newTableNumber } })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewTableNumber('');
                    loadAllData();
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Bağlantı hatası!");
            });
    };

    const deleteTable = (id) => {
        if (!window.confirm("Masayı silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/tables/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    // --- KATEGORİ İŞLEMLERİ ---
    const addCategory = (e) => {
        e.preventDefault();
        apiFetch('/api/admin/categories', { role: 'admin', method: 'POST', body: { name: newCategoryName } })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewCategoryName('');
                    loadAllData();
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Bağlantı hatası!");
            });
    };

    const deleteCategory = (id) => {
        if (!window.confirm("Bu kategoriyi ve içindeki TÜM ürünleri silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/categories/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    // --- ÜRÜN İŞLEMLERİ ---
    const addProduct = async (e) => {
        e.preventDefault();

        if (!newProduct.category_id || !newProduct.name || !newProduct.price) {
            alert("Lütfen tüm alanları (Kategori, Ürün Adı, Fiyat) doldurun!");
            return;
        }

        let imageUrl = null;

        if (imageFile) {
            if (!IMGBB_API_KEY) {
                alert("Görsel yüklemek için .env dosyasına VITE_IMGBB_API_KEY değerini ekleyin.");
                return;
            }

            const imgData = new FormData();
            imgData.append("image", imageFile);

            try {
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: "POST",
                    body: imgData
                });
                const result = await response.json();

                if (result.success) {
                    imageUrl = result.data.url;
                } else {
                    alert("Resim buluta yüklenemedi!");
                    return;
                }
            } catch (error) {
                console.error("Bulut yükleme hatası:", error);
                alert("Resim yükleme servisine ulaşılamadı.");
                return;
            }
        }

        apiFetch('/api/admin/products', {
            role: 'admin',
            method: 'POST',
            body: {
                category_id: newProduct.category_id,
                name: newProduct.name,
                price: newProduct.price,
                image: imageUrl
            }
        })
            .then(res => {
                if (res.success) {
                    alert(res.message);
                    setNewProduct({ category_id: '', name: '', price: '' });
                    setImageFile(null);
                    const fileInput = document.getElementById('productImageInput');
                    if (fileInput) fileInput.value = '';
                    loadAllData();
                } else {
                    alert("⚠️ Hata: " + (res.message || "Ekleme başarısız."));
                }
            })
            .catch(err => {
                if (!handleAuthError(err)) alert("Sunucu bağlantı hatası!");
            });
    };

    const deleteProduct = (id) => {
        if (!window.confirm("Ürünü silmek istediğinize emin misiniz?")) return;
        apiFetch(`/api/admin/products/${id}`, { role: 'admin', method: 'DELETE' })
            .then(() => loadAllData())
            .catch(handleAuthError);
    };

    if (!isAdminLoggedIn) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', fontFamily: 'sans-serif' }}>
                <form onSubmit={handleLogin} style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '320px', border: '1px solid #ddd' }}>
                    <h2 style={{ textAlign: 'center', color: '#333' }}>👑 Admin Dashboard</h2>
                    {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ fontWeight: 'bold' }}>Kullanıcı Adı:</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px' }} placeholder="admin" />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontWeight: 'bold' }}>Şifre:</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px' }} placeholder="admin123" />
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Giriş Yap</button>
                </form>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
                <h2>👑 Yönetici Kontrol Paneli</h2>
                <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Çıkış Yap</button>
            </div>

            {/* SEKMELER */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => setActiveTab('waiters')} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: activeTab === 'waiters' ? '#6f42c1' : '#eee', color: activeTab === 'waiters' ? 'white' : '#333', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>🤵 Garson Yönetimi</button>
                <button onClick={() => setActiveTab('tables')} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: activeTab === 'tables' ? '#6f42c1' : '#eee', color: activeTab === 'tables' ? 'white' : '#333', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>🪑 Masa Yönetimi</button>
                <button onClick={() => setActiveTab('menu')} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: activeTab === 'menu' ? '#6f42c1' : '#eee', color: activeTab === 'menu' ? 'white' : '#333', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>🍔 Menü & Kategori Yönetimi</button>
            </div>

            {/* SEKME 1: GARSON YÖNETİMİ */}
            {activeTab === 'waiters' && (
                <div>
                    <h3>Yeni Garson Ekle</h3>
                    <form onSubmit={addWaiter} style={{ display: 'flex', gap: '10px', marginBottom: '30px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                        <input type="text" placeholder="Ad Soyad" value={newWaiter.name} onChange={e => setNewWaiter({ ...newWaiter, name: e.target.value })} required style={{ padding: '8px' }} />
                        <input type="text" placeholder="Kullanıcı Adı" value={newWaiter.username} onChange={e => setNewWaiter({ ...newWaiter, username: e.target.value })} required style={{ padding: '8px' }} />
                        <input type="password" placeholder="Şifre" value={newWaiter.password} onChange={e => setNewWaiter({ ...newWaiter, password: e.target.value })} required style={{ padding: '8px' }} />
                        <button type="submit" style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Ekle</button>
                    </form>

                    <h3>Mevcut Garsonlar</h3>
                    <ul>
                        {waiters.map(w => (
                            <li key={w.id} style={{ display: 'flex', justifyContent: 'space-between', width: '400px', margin: '8px 0', paddingBottom: '5px', borderBottom: '1px solid #eee' }}>
                                <span><strong>{w.name}</strong> (@{w.username})</span>
                                <button onClick={() => deleteWaiter(w.id)} style={{ backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Sil</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* SEKME 2: MASA YÖNETİMİ */}
            {activeTab === 'tables' && (
                <div>
                    <h3>Yeni Masa Ekle</h3>
                    <form onSubmit={addTable} style={{ display: 'flex', gap: '10px', marginBottom: '30px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                        <input type="text" placeholder="Örn: Masa 6 veya Teras 1" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} required style={{ padding: '8px', width: '250px' }} />
                        <button type="submit" style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Masa Oluştur</button>
                    </form>

                    <h3>Masalar & QR Adresleri</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                        {tables.map(t => (
                            <div key={t.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '18px', color: '#333' }}>{t.table_number}</strong>
                                    <button onClick={() => deleteTable(t.id)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '5px 10px', fontWeight: 'bold' }}>Masayı Sil</button>
                                </div>

                                {/* Linkler ve QR Çıktı Butonu */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '6px', border: '1px dashed #ccc' }}>

                                    {/* Masayı Test Et Linki */}
                                    <a href={menuUrlFor(t.qr_code)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold', fontSize: '14px' }}>
                                        🔗 Test Et ↗
                                    </a>

                                    {/* Yüksek Kaliteli QR Resmini Açan Link */}
                                    <a
                                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(menuUrlFor(t.qr_code))}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ textDecoration: 'none', backgroundColor: '#28a745', color: 'white', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        🖨️ QR Çıkart
                                    </a>

                                </div>

                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SEKME 3: MENÜ & KATEGORİ YÖNETİMİ */}
            {activeTab === 'menu' && (
                <div>
                    {/* 📂 KATEGORİ EKLEME FORMU */}
                    <div style={{ backgroundColor: '#eef2f5', padding: '15px', borderRadius: '8px', marginBottom: '25px' }}>
                        <h3 style={{ marginTop: 0 }}>📂 Yeni Kategori Ekle</h3>
                        <form onSubmit={addCategory} style={{ display: 'flex', gap: '10px' }}>
                            <input type="text" placeholder="Kategori Adı (Örn: Tatlılar)" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required style={{ padding: '8px', width: '250px' }} />
                            <button type="submit" style={{ backgroundColor: '#17a2b8', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Kategori Ekle</button>
                        </form>
                    </div>

                    {/* 🍔 ÜRÜN EKLEME FORMU */}
                    <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
                        <h3 style={{ marginTop: 0 }}>🍔 Yeni Ürün & Görsel Ekle</h3>
                        <form onSubmit={addProduct} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })} required style={{ padding: '8px' }}>
                                <option value="">Kategori Seçin</option>
                                {menu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>

                            <input type="text" placeholder="Ürün Adı" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required style={{ padding: '8px' }} />
                            <input type="number" step="0.01" placeholder="Fiyat (TL)" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required style={{ padding: '8px', width: '100px' }} />

                            <input id="productImageInput" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} style={{ padding: '5px' }} />

                            <button type="submit" style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Ürün Ekle</button>
                        </form>
                    </div>

                    {/* 📜 MENÜ LİSTESİ */}
                    <h3>Mevcut Menü & Kategoriler</h3>
                    {menu.length === 0 && <p style={{ color: '#888' }}>Henüz eklenmiş kategori veya ürün yok.</p>}

                    {menu.map(c => (
                        <div key={c.id} style={{ marginBottom: '25px', border: '1px solid #ddd', borderRadius: '8px', padding: '15px', backgroundColor: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                                <h4 style={{ color: '#6f42c1', margin: 0, fontSize: '18px' }}>📂 {c.name}</h4>
                                <button onClick={() => deleteCategory(c.id)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Kategoriyi Sil</button>
                            </div>

                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {c.products.length === 0 && <li style={{ color: '#aaa', fontStyle: 'italic' }}>Bu kategoride ürün yok.</li>}
                                {c.products.map(p => (
                                    <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px' }} />
                                            ) : (
                                                <div style={{ width: '45px', height: '45px', backgroundColor: '#eee', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#888' }}>Resim Yok</div>
                                            )}
                                            <div>
                                                <strong>{p.name}</strong>
                                                <span style={{ display: 'block', color: '#28a745', fontWeight: 'bold', fontSize: '14px' }}>{p.price} TL</span>
                                            </div>
                                        </div>
                                        <button onClick={() => deleteProduct(p.id)} style={{ backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', padding: '4px 8px', fontSize: '12px' }}>Sil</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Admin;