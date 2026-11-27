// Runs in the page: tags interactive elements with data-agent-ref and returns a compact outline.
export const SNAPSHOT_SCRIPT = `(() => {
	const selector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="combobox"], [contenteditable="true"]';
	const maxElements = 200;
	const hiddenCache = new Map();
	const hidden = (el) => {
		if (!el) return false;
		if (hiddenCache.has(el)) return hiddenCache.get(el);
		const style = getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		const clipped = el !== document.body && el !== document.documentElement && style.display !== 'contents' &&
			((style.overflowX !== 'visible' && rect.width === 0) || (style.overflowY !== 'visible' && rect.height === 0));
		const result = el.getAttribute('aria-hidden') === 'true' || style.display === 'none' ||
			style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0 ||
			style.contentVisibility === 'hidden' || (style.display !== 'contents' && !el.checkVisibility()) ||
			clipped || hidden(el.parentElement);
		hiddenCache.set(el, result);
		return result;
	};
	const onPage = (rect) => rect.width > 0 && rect.height > 0 && rect.right + scrollX > 0 && rect.bottom + scrollY > 0;
	const range = document.createRange();
	const block = (el) => {
		while (el.parentElement && /^(inline|contents)/.test(getComputedStyle(el).display)) el = el.parentElement;
		return el;
	};
	const textOf = (root) => {
		const parts = [];
		let last;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => node.nodeType === 1 && hidden(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
		});
		while (walker.nextNode()) {
			const node = walker.currentNode;
			if (node.nodeType === 1) {
				if (node.tagName === 'BR') parts.push('\\n');
				continue;
			}
			const parent = node.parentElement;
			if (!parent || hidden(parent)) continue;
			const pre = /^(pre|break-spaces)/.test(getComputedStyle(parent).whiteSpace);
			let value = pre ? node.data : node.data.replace(/\\s+/g, ' ');
			if (!value.trim()) {
				if (pre || !/\\s$/.test(parts[parts.length - 1] ?? '\\n')) parts.push(value);
				continue;
			}
			range.selectNodeContents(node);
			if (!onPage(range.getBoundingClientRect())) continue;
			const box = block(parent);
			if (box !== last) {
				parts.push('\\n');
				last = box;
				if (!pre) value = value.trimStart();
			}
			parts.push(value);
		}
		return parts.join('').replace(/[ \\t]+\\n/g, '\\n').trim();
	};
	for (const el of document.querySelectorAll('[data-agent-ref]')) el.removeAttribute('data-agent-ref');
	const candidates = [...document.querySelectorAll(selector)].filter((el) => onPage(el.getBoundingClientRect()) && !hidden(el));
	const inView = (el) => {
		const rect = el.getBoundingClientRect();
		return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
	};
	const ordered = [...candidates.filter(inView), ...candidates.filter((el) => !inView(el))].slice(0, maxElements);
	const elements = [];
	let i = 0;
	for (const el of ordered) {
		i += 1;
		const ref = 'e' + i;
		el.setAttribute('data-agent-ref', ref);
		elements.push({
			ref,
			tag: el.tagName.toLowerCase(),
			role: el.getAttribute('role') || undefined,
			type: el.getAttribute('type') || undefined,
			text: ((el.tagName === 'SELECT' ? el.innerText : textOf(el)) || (el.type === 'password' ? '' : el.value) || '').trim().slice(0, 120) || undefined,
			name: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || undefined,
			href: el.getAttribute('href') || undefined,
		});
	}
	return {
		title: document.title,
		text: document.body ? textOf(document.body) : '',
		elements,
		elementsTruncated: candidates.length > maxElements
			? 'Only ' + maxElements + ' of ' + candidates.length + ' elements are listed, those on screen first; scroll and snapshot again for the rest.'
			: undefined,
	};
})()`;
