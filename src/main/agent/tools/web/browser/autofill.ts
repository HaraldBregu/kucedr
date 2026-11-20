import { matchLogins } from '../../../../browser/passwords';
import { fillLogin } from '../../../../browser/fill';
import type { BrowserTab } from './pane';

const WORLD = 4118;

// Runs in a private script world the page cannot reach. It watches the user's own focus on
// login fields and draws a suggestions list in a closed shadow root under the field. The page
// cannot read the list, and a choice is accepted only from a trusted (real) key or click.
// The main process polls `probe`, supplies the usernames to show, and does the filling.
const SCRIPT = `((payloadJson) => {
	if (!window.__kucedrAutofill) {
		const af = (window.__kucedrAutofill = { seq: 0, req: null, pick: null, items: [], active: -1, open: false, el: null });
		const host = document.createElement('div');
		host.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;pointer-events:none';
		const root = host.attachShadow({ mode: 'closed' });
		root.innerHTML =
			'<style>' +
			'.box{position:fixed;min-width:220px;max-width:420px;background:#1f2023;color:#e8e8ea;border:1px solid #3a3b40;border-radius:12px;padding:4px;box-shadow:0 10px 30px rgba(0,0,0,.4);font:13px -apple-system,system-ui,sans-serif;pointer-events:auto}' +
			'@media (prefers-color-scheme: light){.box{background:#fff;color:#1b1b1f;border-color:#e2e2e6}}' +
			'.row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:default;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.row.on{background:#2563eb;color:#fff}' +
			'.k{opacity:.6;font-size:11px}' +
			'</style><div class="box"></div>';
		af.box = root.querySelector('.box');
		const nameHints = /user|login|email|e-mail|account|identifier|phone|tel/i;
		af.isLogin = (el) => {
			if (!(el instanceof HTMLInputElement)) return false;
			if (el.type === 'password') return true;
			if (!['text', 'email', 'tel', ''].includes(el.type)) return false;
			const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
			if (/username|email|tel/.test(ac)) return true;
			if (ac === 'off' && el.type === 'text') { /* still allow by name */ }
			const words = [el.name, el.id, el.getAttribute('aria-label'), el.placeholder].join(' ');
			if (!nameHints.test(words)) return false;
			// only when the form also has a password field, so plain search boxes are ignored
			const form = el.form || document;
			return Boolean(form.querySelector('input[type=password]'));
		};
		af.position = () => {
			if (!af.el) return;
			const r = af.el.getBoundingClientRect();
			af.box.style.left = Math.min(r.left, innerWidth - 240) + 'px';
			af.box.style.top = r.bottom + 4 + 'px';
			af.box.style.minWidth = Math.max(220, r.width) + 'px';
		};
		af.render = () => {
			af.box.innerHTML = af.items
				.map(
					(it, i) =>
						'<div class="row' + (i === af.active ? ' on' : '') + '" data-i="' + i + '">' +
						'<span style="overflow:hidden;text-overflow:ellipsis">' + it.label.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) + '</span>' +
						(it.key ? '<span class="k">' + it.key + '</span>' : '') +
						'</div>'
				)
				.join('');
		};
		af.apply = (items) => {
			af.items = items;
			af.active = items.length ? 0 : -1;
			if (!items.length) return af.hide();
			if (!host.isConnected) document.documentElement.appendChild(host);
			af.open = true;
			af.position();
			af.render();
		};
		af.hide = () => {
			af.open = false;
			af.req = null;
			af.el = null;
			host.remove();
		};
		af.move = (d) => {
			if (!af.items.length) return;
			af.active = (af.active + d + af.items.length) % af.items.length;
			af.render();
		};
		af.choose = (i) => {
			af.pick = i;
			af.hide();
		};
		document.addEventListener(
			'focusin',
			(e) => {
				if (af.isLogin(e.target)) { af.el = e.target; af.seq += 1; af.req = { origin: location.origin }; }
				else if (!host.contains(e.target)) af.hide();
			},
			true
		);
		document.addEventListener('scroll', () => { if (af.open) af.position(); }, true);
		window.addEventListener('resize', () => { if (af.open) af.position(); });
		document.addEventListener(
			'keydown',
			(e) => {
				if (!af.open || !e.isTrusted) return;
				if (e.key === 'ArrowDown') { e.preventDefault(); af.move(1); }
				else if (e.key === 'ArrowUp') { e.preventDefault(); af.move(-1); }
				else if (e.key === 'Enter' && af.active >= 0) { e.preventDefault(); af.choose(af.active); }
				else if (e.key === 'Escape') { e.preventDefault(); af.hide(); }
			},
			true
		);
		af.box.addEventListener('mousedown', (e) => {
			const row = e.target.closest('[data-i]');
			if (row && e.isTrusted) { e.preventDefault(); af.choose(Number(row.dataset.i)); }
		});
	}
	const af = window.__kucedrAutofill;
	const payload = payloadJson ? JSON.parse(payloadJson) : null;
	if (payload && payload.seq === af.seq) af.apply(payload.items);
	const pick = af.pick;
	af.pick = null;
	return JSON.stringify({ seq: af.seq, origin: af.req && af.req.origin, pick });
})`;

interface State {
	seq: number;
	origin: string | null;
	pick: number | null;
}

const lastSeq = new WeakMap<BrowserTab, number>();
const shownItems = new WeakMap<BrowserTab, { id: string; label: string }[]>();

async function probe(tab: BrowserTab, push: string | null): Promise<State> {
	const json = (await tab.view.webContents.executeJavaScriptInIsolatedWorld(WORLD, [
		{ code: `${SCRIPT}(${push === null ? 'null' : JSON.stringify(push)})` },
	])) as string;
	return JSON.parse(json) as State;
}

export async function pollAutofill(tab: BrowserTab): Promise<void> {
	if (tab.view.webContents.isDestroyed()) return;
	const state = await probe(tab, null).catch(() => null);
	if (!state) return;
	if (state.pick !== null) {
		const chosen = shownItems.get(tab)?.[state.pick];
		if (chosen) await fillLogin(tab, chosen.id).catch(() => undefined);
		return;
	}
	if (state.seq === lastSeq.get(tab)) return;
	lastSeq.set(tab, state.seq);
	const items = state.origin
		? matchLogins(state.origin).map((login) => ({ id: login.id, label: loginLabel(login), key: '' }))
		: [];
	shownItems.set(tab, items);
	// push right away so the list appears without waiting for the next poll
	await probe(tab, JSON.stringify({ seq: state.seq, items })).catch(() => undefined);
}

export function resetAutofill(tab: BrowserTab): void {
	lastSeq.delete(tab);
	shownItems.delete(tab);
}
