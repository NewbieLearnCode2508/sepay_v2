let gamesList = [];

async function loadGames(filter = 'all') {
    let url = '/api/games';
    if (filter !== 'all') url += `?filter=${encodeURIComponent(filter)}`;
    const res = await authFetch(url);
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
    gamesList.forEach(game => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-name">${escapeHtml(game.game_name)}</div>
            <div class="product-price">${game.price.toLocaleString()}₫</div>
            <div class="qty-control">Còn lại: ${game.available} tài khoản</div>
            <button class="buy-btn" data-game="${escapeHtml(game.game_name)}">Mua ngay</button>
        `;
        grid.appendChild(card);
    });
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
                await loadUserInfo();
                loadGames(document.getElementById('gameFilter').value);
            } catch (err) {
                alert(err.message);
            }
        });
    });
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.getElementById('gameFilter').addEventListener('change', (e) => loadGames(e.target.value));
loadGames();