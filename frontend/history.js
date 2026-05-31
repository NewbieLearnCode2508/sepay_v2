async function loadPurchaseHistory() {
    const res = await authFetch('/api/purchase-history');
    if (!res.ok) return;
    const history = await res.json();
    const tbody = document.getElementById('historyBody');
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
loadPurchaseHistory();