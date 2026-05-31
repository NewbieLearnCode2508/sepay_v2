document.getElementById('sendContactBtn').addEventListener('click', async () => {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const subject = document.getElementById('contactSubject').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    if (!name || !email || !message) return alert('Vui lòng nhập đầy đủ họ tên, email và nội dung');
    const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    alert('Cảm ơn bạn, chúng tôi sẽ phản hồi sớm nhất!');
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactSubject').value = '';
    document.getElementById('contactMessage').value = '';
});