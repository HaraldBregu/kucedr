(() => {
	if (typeof window.app?.getAppStoreValue === 'function') {
		window.store = {
			get: (key) => window.app.getAppStoreValue(key).catch(() => undefined),
			set: (key, value) => window.app.setAppStoreValue(key, value).catch(() => undefined),
		};
		return;
	}
	const pending = new Map();
	let next = 0;
	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) return;
		const { kucedrStore, value } = event.data ?? {};
		pending.get(kucedrStore)?.(value);
		pending.delete(kucedrStore);
	});
	const call = (op, key, value) =>
		new Promise((resolve) => {
			const id = ++next;
			pending.set(id, resolve);
			window.parent.postMessage({ kucedrStore: id, op, key, value }, '*');
		});
	window.store = {
		get: (key) => call('get', key),
		set: (key, value) => call('set', key, value),
	};
})();
