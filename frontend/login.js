const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const doLoginBtn = document.getElementById('doLoginBtn');
const doRegisterBtn = document.getElementById('doRegisterBtn');

if (showRegisterBtn) showRegisterBtn.addEventListener('click', () => { loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
if (showLoginBtn) showLoginBtn.addEventListener('click', () => { registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

doLoginBtn.addEventListener('click', async () => {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return alert('Nhập đầy đủ thông tin');
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    localStorage.setItem('token', data.token);
    currentToken = data.token;
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect') || '/';
    window.location.href = redirect;
});

doRegisterBtn.addEventListener('click', async () => {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!username || !password) return alert('Nhập đầy đủ thông tin');
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    alert('Đăng ký thành công! Vui lòng đăng nhập.');
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});