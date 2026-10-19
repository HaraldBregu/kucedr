const text = document.getElementById('text');
const count = document.getElementById('count');
text.addEventListener('input', () => {
	const words = text.value.trim().split(/\s+/).filter(Boolean).length;
	count.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
});
