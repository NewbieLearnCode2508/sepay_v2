document.getElementById('changePwdBtn').addEventListener('click', async () => {
    const oldPass = document.getElementById('oldPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (newPass !== confirm) return alert('Mật khẩu xác nhận không khớp');
    if (!oldPass || !newPass) return alert('Vui lòng nhập đầy đủ');
    const res = await authFetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPass, new_password: newPass })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
    logout();
});