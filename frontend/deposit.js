let pollingInterval = null;

document.getElementById('depositBtn')?.addEventListener('click', async () => {
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
                await loadUserInfo();
                setTimeout(() => {
                    document.getElementById('qrSection').classList.add('hidden');
                    alert('Nạp tiền thành công!');
                }, 1500);
            }
        }, 3000);
    } catch (e) { alert(e.message); }
});