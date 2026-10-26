(() => {
	const credits = Number(new URLSearchParams(location.hash.slice(1)).get('credits')) || 0;
	addEventListener('load', () => {
		dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c' }));
		setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', key: 'c' })), 100);
	});
	addEventListener('keydown', (event) => {
		if (event.key === 'Escape') location.href = `../../index.html#screen=select&credits=${credits}`;
	});
})();
