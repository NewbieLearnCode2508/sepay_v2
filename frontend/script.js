// ================== CẤU HÌNH ==================
const API_BASE = '';
const BANK_ID = '970422';
const ACCOUNT_NO = '0934133644';

let currentToken = localStorage.getItem('token');
let pollingInterval = null;
let gamesList = [];

// ================== HELPER ==================
function authFetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    return fetch(API_BASE + url, { ...options, headers });
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ================== CẬP NHẬT SỐ DƯ ==================
async function updateBalanceUI() {
    try {
        const res = await authFetch('/api/me');
        if (!res.ok) throw new Error('Unauthorized');
        const user = await res.json();
        // Cập nhật ở sidebar
        const balanceSidebar = document.getElementById('balanceSidebar');
        if (balanceSidebar) balanceSidebar.innerText = user.balance.toLocaleString();
        // Vẫn hỗ trợ giao diện cũ nếu có
        const oldBalance = document.getElementById('balance');
        if (oldBalance) oldBalance.innerText = user.balance.toLocaleString();
        return user.balance;
    } catch (e) {
        if (e.message === 'Unauthorized') logout();
        return 0;
    }
}

// ================== DANH SÁCH GAME ==================
async function loadGames() {
    const res = await authFetch('/api/games');
    if (res.ok) {
        gamesList = await res.json();
        renderGames();
    }
}

function renderGames() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    if (gamesList.length === 0) {
        grid.innerHTML = '<div style="text-align:center;">Hiện chưa có tài khoản game nào.</div>';
        return;
    }
    grid.innerHTML = '';
    for (let game of gamesList) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-name">${escapeHtml(game.game_name)}</div>
            <div class="product-price">${game.price.toLocaleString()}₫</div>
            <div class="qty-control">Còn lại: ${game.available} tài khoản</div>
            <button class="buy-btn" data-game="${escapeHtml(game.game_name)}" data-price="${game.price}"><i class="fas fa-bolt"></i> Mua ngay</button>
        `;
        grid.appendChild(card);
    }
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const gameName = btn.dataset.game;
            try {
                const res = await authFetch('/api/purchase', {
                    method: 'POST',
                    body: JSON.stringify({ game_name: gameName })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                alert(`✅ Mua thành công! Tài khoản: ${data.account_username}\nSố dư mới: ${data.new_balance.toLocaleString()}₫`);
                await updateBalanceUI();
                if (document.getElementById('historyTab')?.classList.contains('active')) {
                    loadPurchaseHistory();
                }
                loadGames();
            } catch (err) {
                alert(err.message);
            }
        });
    });
}

// ================== LỊCH SỬ MUA HÀNG ==================
async function loadPurchaseHistory() {
    const res = await authFetch('/api/purchase-history');
    if (!res.ok) return;
    const history = await res.json();
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chưa có giao dịch mua tài khoản</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    for (let h of history) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = h.game_name;
        row.insertCell(1).innerText = h.username;
        row.insertCell(2).innerText = h.total_amount.toLocaleString() + '₫';
        row.insertCell(3).innerText = new Date(h.created_at).toLocaleString();
        const btnCell = row.insertCell(4);
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'Xem mật khẩu';
        viewBtn.className = 'view-password-btn';
        viewBtn.style.background = '#2d6a4f';
        viewBtn.style.color = 'white';
        viewBtn.style.border = 'none';
        viewBtn.style.padding = '4px 12px';
        viewBtn.style.borderRadius = '20px';
        viewBtn.style.cursor = 'pointer';
        viewBtn.dataset.id = h.id;
        viewBtn.addEventListener('click', async () => {
            try {
                const pwRes = await authFetch(`/api/account-password/${h.id}`);
                const pwData = await pwRes.json();
                if (!pwRes.ok) throw new Error(pwData.error);
                alert(`Mật khẩu tài khoản: ${pwData.password}`);
            } catch (e) {
                alert(e.message);
            }
        });
        btnCell.appendChild(viewBtn);
    }
}

// ================== NẠP TIỀN ==================
const depositBtn = document.getElementById('depositBtn');
if (depositBtn) {
    depositBtn.addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('amount').value);
        if (isNaN(amount) || amount <= 0) return alert('Số tiền không hợp lệ');
        try {
            const res = await authFetch('/api/deposit', { method: 'POST', body: JSON.stringify({ amount }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const orderCode = data.order_code;
            const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact.png?amount=${amount}&addInfo=${orderCode}`;
            document.getElementById('qrImg').src = qrUrl;
            document.getElementById('orderCode').innerText = orderCode;
            document.getElementById('qrSection').classList.remove('hidden');
            document.getElementById('statusMsg').innerHTML = '<i class="fas fa-hourglass-half"></i> Đang chờ thanh toán...';
            if (pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(async () => {
                const statusRes = await authFetch(`/api/deposit-status/${orderCode}`);
                const statusData = await statusRes.json();
                if (statusData.status === 'paid') {
                    clearInterval(pollingInterval);
                    document.getElementById('statusMsg').innerHTML = '<i class="fas fa-check-circle"></i> Nạp tiền thành công!';
                    await updateBalanceUI();
                    setTimeout(() => {
                        document.getElementById('qrSection').classList.add('hidden');
                        alert('Nạp tiền thành công!');
                    }, 1500);
                }
            }, 3000);
        } catch (e) { alert(e.message); }
    });
}

// ================== CHUYỂN TAB (SIDEBAR) ==================
function activateTab(tabId) {
    // Ẩn tất cả tab content
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    const activeTab = document.getElementById(`${tabId}Tab`);
    if (activeTab) activeTab.classList.add('active');
    // Cập nhật active class trên sidebar links
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.tab === tabId) link.classList.add('active');
    });
    // Tải dữ liệu theo tab
    if (tabId === 'shop' && gamesList.length === 0) loadGames();
    if (tabId === 'history') loadPurchaseHistory();
}

// Gắn sự kiện cho sidebar
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.dataset.tab;
        if (tabId) activateTab(tabId);
    });
});

// Nút làm mới số dư
const refreshBtn = document.getElementById('refreshBalanceBtn');
if (refreshBtn) refreshBtn.addEventListener('click', () => updateBalanceUI());

// ================== ĐĂNG NHẬP / ĐĂNG KÝ (MODAL) ==================
let isLoginMode = true;
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const loginBtn = document.getElementById('loginBtn');
const switchBtn = document.getElementById('switchToRegister');
const authModal = document.getElementById('authModal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const loginLinkHeader = document.getElementById('loginLinkHeader');
const registerLinkHeader = document.getElementById('registerLinkHeader');
const logoutBtnHeader = document.getElementById('logoutBtnHeader');

async function login(username, password) {
    const res = await fetch(API_BASE + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    localStorage.setItem('token', data.token);
    currentToken = data.token;
    await loadApp();
    hideModal();
}

async function register(username, password) {
    const res = await fetch(API_BASE + '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert('Đăng ký thành công! Hãy đăng nhập.');
}

function showModal() { if (authModal) authModal.classList.remove('hidden'); }
function hideModal() { if (authModal) authModal.classList.add('hidden'); }

if (loginBtn) {
    loginBtn.onclick = async () => {
        const username = authUsername.value.trim();
        const password = authPassword.value;
        if (!username || !password) return alert('Nhập đủ thông tin');
        if (isLoginMode) {
            try { await login(username, password); }
            catch (e) { alert(e.message); }
        } else {
            try { await register(username, password); }
            catch (e) { alert(e.message); }
        }
    };
}
if (switchBtn) {
    switchBtn.onclick = () => {
        isLoginMode = !isLoginMode;
        loginBtn.innerHTML = isLoginMode ? '<i class="fas fa-sign-in-alt"></i> Đăng nhập' : '<i class="fas fa-user-plus"></i> Đăng ký';
        switchBtn.innerText = isLoginMode ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập';
    };
}
closeModalBtns.forEach(btn => btn.addEventListener('click', hideModal));
if (loginLinkHeader) loginLinkHeader.addEventListener('click', (e) => { e.preventDefault(); showModal(); });
if (registerLinkHeader) registerLinkHeader.addEventListener('click', (e) => { e.preventDefault(); isLoginMode = false; showModal(); });
if (logoutBtnHeader) logoutBtnHeader.addEventListener('click', logout);

function logout() {
    localStorage.removeItem('token');
    currentToken = null;
    if (pollingInterval) clearInterval(pollingInterval);
    const qrSection = document.getElementById('qrSection');
    if (qrSection) qrSection.classList.add('hidden');
    gamesList = [];
    loadApp();
}

// ================== HIỂN THỊ APP KHI ĐĂNG NHẬP ==================
async function loadApp() {
    if (!currentToken) {
        const appSection = document.getElementById('appSection');
        if (appSection) appSection.classList.add('hidden');
        const authSectionHeader = document.getElementById('authSectionHeader');
        if (authSectionHeader) authSectionHeader.classList.remove('hidden');
        const userMenu = document.getElementById('userMenu');
        if (userMenu) userMenu.classList.add('hidden');
        return;
    }
    try {
        const res = await authFetch('/api/me');
        if (!res.ok) throw new Error();
        const user = await res.json();
        const usernameSpan = document.getElementById('usernameDisplay');
        if (usernameSpan) usernameSpan.innerText = user.username;
        await updateBalanceUI();
        // Ẩn auth links, hiện user menu
        const authSectionHeader = document.getElementById('authSectionHeader');
        if (authSectionHeader) authSectionHeader.classList.add('hidden');
        const userMenu = document.getElementById('userMenu');
        if (userMenu) userMenu.classList.remove('hidden');
        // Hiện app
        const appSection = document.getElementById('appSection');
        if (appSection) appSection.classList.remove('hidden');
        activateTab('deposit');
        loadGames();
    } catch (e) {
        logout();
    }
}

// ================== KHỞI TẠO SLIDER (nếu có Swiper) ==================
if (typeof Swiper !== 'undefined') {
    new Swiper(".mySwiper", {
        pagination: { el: ".swiper-pagination", clickable: true },
        navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
        autoplay: { delay: 5000 }
    });
}

// ================== ĐÓNG POPUP ==================
// Đóng khi click vào nút X
document.querySelectorAll('#authModal .modal-content .close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        console.log('Adding click event to close button');
        const modal = document.getElementById('authModal');
        console.log('Modal element:', modal);
        if (modal) modal.classList.add('hidden');
    });
});

// Đóng khi click ra ngoài modal
window.addEventListener('click', (e) => {
    const modal = document.getElementById('authModal');
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// Đóng khi nhấn phím ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('authModal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    }
});

// ================== BẮT ĐẦU ==================
loadApp();