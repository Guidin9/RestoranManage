// Tüm ekranların ortak API katmanı: adres, token saklama ve istek gönderme.

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY || '';

const TOKEN_KEYS = {
    admin: 'admin_token',
    cashier: 'cashier_token',
    waiter: 'waiter_token',
};

export function getToken(role) {
    return localStorage.getItem(TOKEN_KEYS[role]);
}

export function setToken(role, token) {
    localStorage.setItem(TOKEN_KEYS[role], token);
}

export function clearToken(role) {
    localStorage.removeItem(TOKEN_KEYS[role]);
}

// Token geçersizse (401) ekranların giriş formuna dönebilmesi için ayrı bir hata tipi.
export class UnauthorizedError extends Error {
    constructor(message = 'Oturumunuz sona erdi, lütfen tekrar giriş yapın.') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

/**
 * @param {string} path      "/api/..." ile başlayan uç adresi
 * @param {object} options   role: token'ı hangi ekrandan alacağı; body: JSON gövde
 */
export async function apiFetch(path, { role = null, method = 'GET', body = null, headers = {} } = {}) {
    const finalHeaders = { Accept: 'application/json', ...headers };

    if (body !== null) {
        finalHeaders['Content-Type'] = 'application/json';
    }

    const token = role ? getToken(role) : null;
    if (token) {
        finalHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: finalHeaders,
        body: body !== null ? JSON.stringify(body) : undefined,
    });

    // 401: token yok/süresi doldu. 403: token var ama bu uca yetkisi yok.
    if ((response.status === 401 || response.status === 403) && role) {
        clearToken(role);
        throw new UnauthorizedError();
    }

    return response.json();
}
