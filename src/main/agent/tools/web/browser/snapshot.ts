// Runs in the page: tags interactive elements with data-agent-ref and returns a compact outline.
export const SNAPSHOT_SCRIPT = `(() => {
	const selector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="combobox"], [contenteditable="true"]';
	const visible = (el) => {
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return false;
		const style = getComputedStyle(el);
		return style.visibility !== 'hidden' && style.display !== 'none';
	};
	for (const el of document.querySelectorAll('[data-agent-ref]')) el.removeAttribute('data-agent-ref');
	const elements = [];
	let i = 0;
	for (const el of document.querySelectorAll(selector)) {
		if (!visible(el)) continue;
		i += 1;
		const ref = 'e' + i;
		el.setAttribute('data-agent-ref', ref);
		elements.push({
			ref,
			tag: el.tagName.toLowerCase(),
			role: el.getAttribute('role') || undefined,
			type: el.getAttribute('type') || undefined,
			text: (el.innerText || (el.type === 'password' ? '' : el.value) || '').trim().slice(0, 120) || undefined,
			name: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || undefined,
			href: el.getAttribute('href') || undefined,
		});
	}
	return { title: document.title, text: (document.body?.innerText || '').trim(), elements };
})()`;
