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
            <div className="login-wrap">
                <form onSubmit={handleLogin} className="login-card">
                    <span className="login-emoji">👑</span>
                    <h2>Admin Dashboard</h2>
                    <p className="login-sub">Yönetici kontrol paneline giriş</p>
                    {error && <div className="alert">{error}</div>}
                    <div className="field">
                        <label className="label">Kullanıcı Adı</label>
                        <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required placeholder="admin" />
                    </div>
                    <div className="field">
                        <label className="label">Şifre</label>
                        <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">Giriş Yap →</button>
                </form>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="topbar">
                <h2>👑 Yönetici Kontrol Paneli</h2>
                <button onClick={handleLogout} className="btn btn-danger btn-sm">🔒 Çıkış Yap</button>
            </div>

            {/* SEKMELER */}
            <div className="tabs">
                <button onClick={() => setActiveTab('waiters')} className={`tab ${activeTab === 'waiters' ? 'active' : ''}`}>🤵 Garson Yönetimi</button>
                <button onClick={() => setActiveTab('tables')} className={`tab ${activeTab === 'tables' ? 'active' : ''}`}>🪑 Masa Yönetimi</button>
                <button onClick={() => setActiveTab('menu')} className={`tab ${activeTab === 'menu' ? 'active' : ''}`}>🍔 Menü & Kategori</button>
            </div>

            {/* SEKME 1: GARSON YÖNETİMİ */}
            {activeTab === 'waiters' && (
                <div className="reveal">
                    <h3 style={{ marginBottom: 12 }}>Yeni Garson Ekle</h3>
                    <form onSubmit={addWaiter} className="form-inline">
                        <input type="text" className="input" placeholder="Ad Soyad" value={newWaiter.name} onChange={e => setNewWaiter({ ...newWaiter, name: e.target.value })} required />
                        <input type="text" className="input" placeholder="Kullanıcı Adı" value={newWaiter.username} onChange={e => setNewWaiter({ ...newWaiter, username: e.target.value })} required />
                        <input type="password" className="input" placeholder="Şifre" value={newWaiter.password} onChange={e => setNewWaiter({ ...newWaiter, password: e.target.value })} required />
                        <button type="submit" className="btn btn-success">+ Ekle</button>
                    </form>

                    <h3 style={{ marginBottom: 12 }}>Mevcut Garsonlar</h3>
                    <ul className="list-plain" style={{ maxWidth: 460 }}>
                        {waiters.map(w => (
                            <li key={w.id}>
                                <span><strong>{w.name}</strong> <span className="muted">@{w.username}</span></span>
                                <button onClick={() => deleteWaiter(w.id)} className="btn btn-danger btn-sm">Sil</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* SEKME 2: MASA YÖNETİMİ */}
            {activeTab === 'tables' && (
                <div className="reveal">
                    <h3 style={{ marginBottom: 12 }}>Yeni Masa Ekle</h3>
                    <form onSubmit={addTable} className="form-inline">
                        <input type="text" className="input" placeholder="Örn: Masa 6 veya Teras 1" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} required />
                        <button type="submit" className="btn btn-success">+ Masa Oluştur</button>
                    </form>

                    <h3 style={{ marginBottom: 12 }}>Masalar & QR Adresleri</h3>
                    <div className="grid grid-wide">
                        {tables.map((t, ti) => (
                            <div key={t.id} className="card reveal" style={{ '--i': ti }}>
                                <div className="row-between" style={{ marginBottom: 12 }}>
                                    <strong style={{ fontSize: 18, color: 'var(--text-strong)' }}>{t.table_number}</strong>
                                    <button onClick={() => deleteTable(t.id)} className="btn btn-danger btn-sm">Masayı Sil</button>
                                </div>

                                {/* Linkler ve QR Çıktı Butonu */}
                                <div className="qr-box">
                                    <a href={menuUrlFor(t.qr_code)} target="_blank" rel="noreferrer" className="link">🔗 Test Et ↗</a>
                                    <a
                                        href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(menuUrlFor(t.qr_code))}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-success btn-sm"
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
                <div className="reveal">
                    {/* 📂 KATEGORİ EKLEME FORMU */}
                    <h3 style={{ marginBottom: 12 }}>📂 Yeni Kategori Ekle</h3>
                    <form onSubmit={addCategory} className="form-inline">
                        <input type="text" className="input" placeholder="Kategori Adı (Örn: Tatlılar)" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required />
                        <button type="submit" className="btn btn-primary">+ Kategori Ekle</button>
                    </form>

                    {/* 🍔 ÜRÜN EKLEME FORMU */}
                    <h3 style={{ marginBottom: 12 }}>🍔 Yeni Ürün & Görsel Ekle</h3>
                    <form onSubmit={addProduct} className="form-inline">
                        <select className="select" value={newProduct.category_id} onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })} required>
                            <option value="">Kategori Seçin</option>
                            {menu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <input type="text" className="input" placeholder="Ürün Adı" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required />
                        <input type="number" step="0.01" className="input" style={{ flex: '0 1 120px' }} placeholder="Fiyat (TL)" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required />

                        <input id="productImageInput" type="file" accept="image/*" className="input" onChange={(e) => setImageFile(e.target.files[0])} />

                        <button type="submit" className="btn btn-success">+ Ürün Ekle</button>
                    </form>

                    {/* 📜 MENÜ LİSTESİ */}
                    <h3 style={{ marginBottom: 12 }}>Mevcut Menü & Kategoriler</h3>
                    {menu.length === 0 && (
                        <div className="empty"><span className="empty-emoji">📭</span><p>Henüz eklenmiş kategori veya ürün yok.</p></div>
                    )}

                    {menu.map((c, ci) => (
                        <div key={c.id} className="card reveal" style={{ marginBottom: 20, '--i': ci }}>
                            <div className="row-between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--glass-border)', marginBottom: 12 }}>
                                <h4 className="cat-title" style={{ margin: 0, fontSize: 18 }}>{c.name}</h4>
                                <button onClick={() => deleteCategory(c.id)} className="btn btn-danger btn-sm">Kategoriyi Sil</button>
                            </div>

                            <ul className="prod-list">
                                {c.products.length === 0 && <li className="muted" style={{ fontStyle: 'italic', borderBottom: 0 }}>Bu kategoride ürün yok.</li>}
                                {c.products.map(p => (
                                    <li key={p.id} className="prod-row">
                                        <div className="prod-left">
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} className="thumb-sm" />
                                            ) : (
                                                <div className="thumb-sm thumb-sm--empty">Resim<br />Yok</div>
                                            )}
                                            <div>
                                                <strong style={{ color: 'var(--text-strong)' }}>{p.name}</strong>
                                                <span className="prod-price" style={{ display: 'block' }}>{p.price} TL</span>
                                            </div>
                                        </div>
                                        <button onClick={() => deleteProduct(p.id)} className="btn btn-danger btn-sm">Sil</button>
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