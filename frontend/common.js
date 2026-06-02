const API_BASE = '';
const BANK_ID = '970422';
const ACCOUNT_NO = '0934133644';

let currentToken = localStorage.getItem('token');
let currentUser = null;

function authFetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    return fetch(API_BASE + url, { ...options, headers });
}

async function loadUserInfo() {
    if (!currentToken) return null;
    try {
        const res = await authFetch('/api/me');
        if (!res.ok) throw new Error();
        currentUser = await res.json();
        // Cập nhật các phần tử hiển thị
        const usernameSpan = document.getElementById('usernameDisplay');
        if (usernameSpan) usernameSpan.innerText = currentUser.username;
        const balanceSpan = document.getElementById('userBalance');
        if (balanceSpan) balanceSpan.innerText = currentUser.balance.toLocaleString();
        // Hiển thị user menu, ẩn auth links
        const authHeader = document.getElementById('authSectionHeader');
        const userMenu = document.getElementById('userMenu');
        if (authHeader) authHeader.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        return currentUser;
    } catch (e) {
        logout();
        return null;
    }
}

function updateBalanceUI() {
    const balanceSpan = document.getElementById('userBalance');
    if (balanceSpan && currentUser) balanceSpan.innerText = currentUser.balance.toLocaleString();
}

function logout() {
    localStorage.removeItem('token');
    currentToken = null;
    currentUser = null;
    window.location.href = '/login';
}

function checkAuth(redirectIfNot = true) {
    if (!currentToken && redirectIfNot) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return false;
    }
    return true;
}

// Hàm này sẽ được gọi sau khi load trang
document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    // Gắn sự kiện logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
});

// Xử lý menu mobile
const mobileBtn = document.querySelector('.mobile-menu-btn');
const navMenu = document.querySelector('.nav-menu');
if (mobileBtn && navMenu) {
    mobileBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        navMenu.classList.toggle('active');
    });
    // Đóng menu khi click ra ngoài
    document.addEventListener('click', function (e) {
        if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !mobileBtn.contains(e.target)) {
            navMenu.classList.remove('active');
        }
    });
}