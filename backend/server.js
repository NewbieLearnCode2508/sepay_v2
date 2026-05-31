const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const JWT_SECRET = 'sepay_demo_secret_key_2025';
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    // Bảng users
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    balance INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Bảng deposit_transactions
    db.run(`CREATE TABLE IF NOT EXISTS deposit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    order_code TEXT UNIQUE,
    amount INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

    // Bảng game_accounts
    db.run(`CREATE TABLE IF NOT EXISTS game_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_name TEXT,
    username TEXT,
    password TEXT,
    price INTEGER,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Bảng purchase_orders
    db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    account_id INTEGER,
    total_amount INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES game_accounts(id)
  )`);

    // Bảng contacts
    db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    subject TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Thêm tài khoản game mẫu nếu chưa có
    db.get(`SELECT COUNT(*) as count FROM game_accounts`, (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare(`INSERT INTO game_accounts (game_name, username, password, price) VALUES (?, ?, ?, ?)`);
            for (let i = 1; i <= 10; i++) stmt.run('Liên Quân Mobile', `lq_user${i}`, `pass${i}`, 50000);
            for (let i = 1; i <= 10; i++) stmt.run('Free Fire', `ff_user${i}`, `ffpass${i}`, 30000);
            for (let i = 1; i <= 10; i++) stmt.run('Genshin Impact', `gi_user${i}`, `gipass${i}`, 80000);
            stmt.finalize();
            console.log('Đã thêm 30 tài khoản game mẫu');
        }
    });
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// ========== AUTH ==========
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
        if (row) return res.status(400).json({ error: 'Username đã tồn tại' });
        const hashed = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashed], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT id, username, password_hash, balance FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, balance: user.balance } });
    });
});

app.get('/api/me', authenticateToken, (req, res) => {
    db.get('SELECT id, username, balance FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

// ========== GAME ==========
app.get('/api/games', (req, res) => {
    const { filter } = req.query;
    let sql = `SELECT game_name, price, COUNT(*) as available FROM game_accounts WHERE status = 'available'`;
    const params = [];
    if (filter && filter !== 'all') {
        sql += ` AND game_name = ?`;
        params.push(filter);
    }
    sql += ` GROUP BY game_name, price`;
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/purchase', authenticateToken, (req, res) => {
    const { game_name } = req.body;
    if (!game_name) return res.status(400).json({ error: 'Thiếu tên game' });
    db.get(`SELECT id, price, username FROM game_accounts WHERE game_name = ? AND status = 'available' ORDER BY RANDOM() LIMIT 1`, [game_name], (err, account) => {
        if (err || !account) return res.status(404).json({ error: 'Hết tài khoản' });
        const total = account.price;
        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'User not found' });
            if (user.balance < total) return res.status(400).json({ error: 'Số dư không đủ' });
            db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [total, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                db.run('UPDATE game_accounts SET status = "sold" WHERE id = ?', [account.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    db.run('INSERT INTO purchase_orders (user_id, account_id, total_amount) VALUES (?, ?, ?)', [req.user.id, account.id, total], (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, newBalance) => {
                            res.json({ success: true, total_amount: total, new_balance: newBalance.balance, account_username: account.username });
                        });
                    });
                });
            });
        });
    });
});

app.get('/api/purchase-history', authenticateToken, (req, res) => {
    db.all(`SELECT po.id, po.total_amount, po.created_at, ga.game_name, ga.username, ga.password FROM purchase_orders po JOIN game_accounts ga ON po.account_id = ga.id WHERE po.user_id = ? ORDER BY po.created_at DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const safeRows = rows.map(row => ({ id: row.id, game_name: row.game_name, username: row.username, total_amount: row.total_amount, created_at: row.created_at, has_password: !!row.password }));
        res.json(safeRows);
    });
});

app.get('/api/account-password/:purchase_id', authenticateToken, (req, res) => {
    const { purchase_id } = req.params;
    db.get(`SELECT ga.password FROM purchase_orders po JOIN game_accounts ga ON po.account_id = ga.id WHERE po.id = ? AND po.user_id = ?`, [purchase_id, req.user.id], (err, row) => {
        if (err || !row) return res.status(403).json({ error: 'Không có quyền truy cập' });
        res.json({ password: row.password });
    });
});

// ========== NẠP TIỀN ==========
app.post('/api/deposit', authenticateToken, (req, res) => {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' });
    const order_code = `DEP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    db.run(`INSERT INTO deposit_transactions (user_id, order_code, amount) VALUES (?, ?, ?)`, [req.user.id, order_code, amount], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, order_code, amount });
    });
});

app.get('/api/deposit-status/:order_code', authenticateToken, (req, res) => {
    const { order_code } = req.params;
    db.get(`SELECT status FROM deposit_transactions WHERE order_code = ? AND user_id = ?`, [order_code, req.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Không tìm thấy' });
        res.json({ status: row.status });
    });
});

// ========== ĐỔI MẬT KHẨU ==========
app.post('/api/change-password', authenticateToken, async (req, res) => {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ error: 'Thiếu thông tin' });
    db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        const valid = await bcrypt.compare(old_password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Mật khẩu cũ không đúng' });
        const newHash = await bcrypt.hash(new_password, 10);
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// ========== LIÊN HỆ ==========
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ error: 'Thiếu thông tin' });
    db.run('INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)', [name, email, subject || '', message], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ========== WEBHOOK ==========
app.post('/webhook/sepay', (req, res) => {
    console.log('🔔 Webhook nhận:', req.body);
    const { transferType, content, transferAmount } = req.body;
    if (transferType !== 'in') return res.status(200).json({ message: 'Ignored' });
    const order_code = content.trim();
    const amount = transferAmount;
    db.get(`SELECT id, user_id FROM deposit_transactions WHERE order_code = ? AND amount = ? AND status = 'pending'`, [order_code, amount], (err, transaction) => {
        if (err || !transaction) return res.status(404).json({ error: 'Transaction not found' });
        db.run(`UPDATE deposit_transactions SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?`, [transaction.id]);
        db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, transaction.user_id], (err2) => {
            if (err2) console.error('Lỗi cập nhật balance:', err2);
            else console.log(`✅ Nạp thành công user ${transaction.user_id}: +${amount}`);
            res.json({ success: true });
        });
    });
});

// ========== ROUTES CHO CÁC TRANG ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../frontend/login.html')));
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, '../frontend/shop.html')));
app.get('/deposit', (req, res) => res.sendFile(path.join(__dirname, '../frontend/deposit.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, '../frontend/history.html')));
app.get('/change-password', (req, res) => res.sendFile(path.join(__dirname, '../frontend/change-password.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, '../frontend/contact.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '../frontend/about.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '../frontend/privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, '../frontend/terms.html')));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server chạy tại http://localhost:${PORT}`));