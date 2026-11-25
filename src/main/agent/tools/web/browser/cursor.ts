import { getAgentCursor } from '../../../../settings_store';
import type { BrowserTab } from './pane';

const WORLD = 4117;

// Runs in a script world of its own, so the page cannot reach the pointer's state, and
// draws inside a closed shadow root that takes no clicks and adds no text to the page.
const SCRIPT = `((mode, x, y, ref) => {
	const id = 'kucedr-agent-cursor';
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let state = globalThis.agentCursor;
	if (mode === 'clear') {
		state?.host.remove();
		globalThis.agentCursor = undefined;
		return 0;
	}
	if (!state || !state.host.isConnected) {
		const host = document.createElement('div');
		host.id = id;
		host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
		const root = host.attachShadow({ mode: 'closed' });
		root.innerHTML = '<style>' +
			'.pointer,.field,.ripple{position:fixed;left:0;top:0;pointer-events:none;opacity:0;transition:opacity .3s}' +
			'.pointer{width:36px;height:36px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));transition:opacity .3s,transform .25s ease-out}' +
			'.field{border:2px solid #2563eb;border-radius:4px;box-sizing:border-box}' +
			'.ripple{width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid #2563eb}' +
			'.ripple.on{animation:ripple .4s ease-out}' +
			'@keyframes ripple{from{opacity:.9;scale:.3}to{opacity:0;scale:1.4}}' +
			'</style>' +
			'<div class="field"></div><div class="ripple"></div>' +
			'<svg class="pointer" viewBox="0 0 22 22"><path d="M3 2l15 7.5-6.5 2L9 18z" fill="#2563eb" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
		document.documentElement.append(host);
		state = globalThis.agentCursor = {
			host,
			pointer: root.querySelector('.pointer'),
			field: root.querySelector('.field'),
			ripple: root.querySelector('.ripple'),
			placed: false,
		};
	}
	clearTimeout(state.timer);
	state.timer = setTimeout(() => {
		state.pointer.style.opacity = 0;
		state.field.style.opacity = 0;
	}, 3000);
	if (mode === 'field') {
		const rect = document.querySelector('[data-agent-ref="' + ref + '"]')?.getBoundingClientRect();
		if (!rect) return 0;
		Object.assign(state.field.style, {
			transform: 'translate(' + (rect.left - 3) + 'px,' + (rect.top - 3) + 'px)',
			width: rect.width + 6 + 'px',
			height: rect.height + 6 + 'px',
			opacity: 1,
		});
		return 0;
	}
	if (mode === 'click') {
		if (reduce) return 0;
		state.ripple.style.transform = 'translate(' + x + 'px,' + y + 'px)';
		state.ripple.classList.remove('on');
		void state.ripple.offsetWidth;
		state.ripple.classList.add('on');
		return 0;
	}
	const glide = state.placed && !reduce;
	state.pointer.style.transitionDuration = glide ? '' : '0s';
	state.pointer.style.transform = 'translate(' + (x - 5) + 'px,' + (y - 3) + 'px)';
	state.pointer.style.opacity = 1;
	state.field.style.opacity = 0;
	state.placed = true;
	return glide ? 250 : 0;
})`;

export async function cursor(
	tab: BrowserTab,
	mode: 'move' | 'click' | 'field' | 'clear',
	at: { x: number; y: number } = { x: 0, y: 0 },
	ref = ''
): Promise<number> {
	if (mode !== 'clear' && !getAgentCursor()) return 0;
	const code =`${SCRIPT}(${JSON.stringify(mode)}, ${at.x}, ${at.y}, ${JSON.stringify(ref)})`;
	return (await tab.view.webContents
		.executeJavaScriptInIsolatedWorld(WORLD, [{ code }])
		.catch(() => 0)) as number;
}
