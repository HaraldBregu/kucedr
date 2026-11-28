import { matchLogins } from '../../../../browser/passwords';
import { fillLogin } from '../../../../browser/fill';
import { randomBytes } from 'node:crypto';
import { BrowserChannels } from '../../../../../shared/ipc_channels_definitions';
import { CAPTURE_PREFIX } from './capture';
import type { BrowserTab } from './pane';

const WORLD = 4118;

function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

// Runs in a private script world the page cannot reach. It watches the user's own focus on
// login fields and draws a suggestions list in a closed shadow root under the field. The page
// cannot read the list, and a choice is accepted only from a trusted (real) key or click.
// The main process polls `probe`, supplies the usernames to show, and does the filling.
const KEY_ICON =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>';

const SCRIPT = `((payloadJson) => {
	if (!window.__kucedrAutofill) {
		const af = (window.__kucedrAutofill = { seq: 0, req: null, pick: null, all: [], items: [], active: -1, open: false, el: null, mode: 'login' });
		const host = document.createElement('div');
		host.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;pointer-events:none';
		const root = host.attachShadow({ mode: 'closed' });
		root.innerHTML =
			'<style>' +
			':host{all:initial}' +
			'.box{--bg:#fff;--fg:#18181b;--muted:#71717a;--line:#e4e4e7;--hover:rgba(24,24,27,.06);--chip:#f4f4f5;' +
			'position:fixed;box-sizing:border-box;width:300px;max-width:min(420px,calc(100vw - 16px));background:var(--bg);color:var(--fg);' +
			'border:1px solid var(--line);border-radius:12px;padding:4px;pointer-events:auto;' +
			'box-shadow:0 12px 32px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.06);' +
			'font:13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;' +
			'animation:in .12s ease-out;user-select:none}' +
			'@media (prefers-color-scheme: dark){.box{--bg:#1c1c1f;--fg:#f4f4f5;--muted:#a1a1aa;--line:#2e2e33;--hover:rgba(255,255,255,.07);--chip:#27272a;box-shadow:0 12px 32px rgba(0,0,0,.5)}}' +
			'@keyframes in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}' +
			'.list{max-height:232px;overflow-y:auto;scrollbar-width:thin}' +
			'.row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:8px;cursor:default}' +
			'.row.on{background:var(--hover)}' +
			'.icon{flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:var(--chip);color:var(--muted)}' +
			'.text{min-width:0;flex:1}' +
			'.name,.site{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
			'.name{font-weight:500}' +
			'.site{margin-top:1px;font-size:11.5px;color:var(--muted)}' +
			'.dots{flex:none;color:var(--muted);letter-spacing:1px;font-size:11px}' +
			'.sep{height:1px;margin:4px 6px;background:var(--line)}' +
			'.foot{color:var(--muted);padding:7px 8px}' +
			'.del{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:6px;color:var(--muted);font-size:15px;line-height:1}' +
			'.del:hover{background:var(--chip);color:var(--fg)}' +
			'</style><div class="box" role="listbox" aria-label="Saved passwords"></div>';
		af.box = root.querySelector('.box');
		const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
		const nameHints = /user|login|email|e-mail|account|identifier|phone|tel/i;
		af.isLogin = (el) => {
			if (!(el instanceof HTMLInputElement)) return false;
			if (el.type === 'password') return true;
			if (!['text', 'email', 'tel', ''].includes(el.type)) return false;
			const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
			if (/username|email|tel/.test(ac)) return true;
			if (ac === 'off' && el.type === 'text') { /* still allow by name */ }
			const hinted = nameHints.test([el.name, el.id, el.getAttribute('aria-label'), el.placeholder].join(' '));
			const isText = (input) => ['text', 'email', 'tel', ''].includes(input.type);
			const fields = [...(el.form || document).querySelectorAll('input')].filter(visible);
			const password = fields.findIndex((input, i) => i > fields.indexOf(el) && input.type === 'password');
			// with a password field after it: a field named like a username, or the one right before the password
			if (password >= 0) return hinted || fields.slice(0, password).reverse().find(isText) === el;
			// a sign-in split over two pages: the only text field of its form, so plain search boxes are ignored
			return hinted && Boolean(el.form) && fields.filter(isText).length === 1;
		};
		// An ordinary text field whose earlier values are worth suggesting: named, not a login,
		// and not a card, one-time code or a field the site asked browsers not to remember.
		af.fieldName = (el) => {
			if (!(el instanceof HTMLInputElement) || !['text', 'email', 'tel', 'search', 'url', ''].includes(el.type)) return '';
			const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
			if (ac === 'off' || /cc-|one-time-code|password/.test(ac) || af.isLogin(el)) return '';
			return (el.name || el.id || '').slice(0, 100);
		};
		// Below the field, or above it when there is no room; kept inside the window.
		af.position = () => {
			if (!af.el || !af.el.isConnected) return af.hide();
			const r = af.el.getBoundingClientRect();
			af.box.style.width = Math.max(300, r.width) + 'px';
			const w = af.box.offsetWidth;
			const h = af.box.offsetHeight;
			af.box.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
			const below = r.bottom + 6;
			af.box.style.top = (below + h > innerHeight - 8 && r.top - 6 - h > 8 ? r.top - 6 - h : below) + 'px';
		};
		// Rows are the matching logins, then "Manage passwords"; the last index is that footer.
		af.render = () => {
			if (af.mode === 'form') {
				af.box.innerHTML =
					'<div class="list">' +
					af.items
						.map(
							(it, i) =>
								'<div class="row' + (i === af.active ? ' on' : '') + '" role="option" data-i="' + i + '">' +
								'<span class="text"><span class="name">' + esc(it.label) + '</span></span>' +
								'<span class="del" role="button" aria-label="Remove" title="Remove" data-del="' + i + '">×</span></div>'
						)
						.join('') +
					'</div>';
				af.box.querySelector('.row.on')?.scrollIntoView({ block: 'nearest' });
				return;
			}
			af.box.innerHTML =
				'<div class="list">' +
				af.items
					.map(
						(it, i) =>
							'<div class="row' + (i === af.active ? ' on' : '') + '" role="option" data-i="' + i + '">' +
							'<span class="icon">${KEY_ICON}</span>' +
							'<span class="text"><span class="name">' + esc(it.label) + '</span><span class="site">' + esc(it.detail) + '</span></span>' +
							'<span class="dots">••••••</span></div>'
					)
					.join('') +
				'</div><div class="sep"></div>' +
				'<div class="row foot' + (af.active === af.items.length ? ' on' : '') + '" role="option" data-i="' + af.items.length + '">Manage passwords…</div>';
			af.box.querySelector('.row.on:not(.foot)')?.scrollIntoView({ block: 'nearest' });
		};
		af.show = () => {
			if (!af.items.length) return af.close();
			if (!host.isConnected) document.documentElement.appendChild(host);
			af.open = true;
			af.render();
			af.position();
		};
		// Typing in the username field narrows the list to names that contain the text. A value
		// the field already held when it was focused does not.
		af.filter = () => {
			const text = af.typed && af.el && af.el.type !== 'password' ? af.el.value.trim().toLowerCase() : '';
			af.items = !text
				? af.all
				: af.mode === 'form'
					? af.all.filter((it) => it.label.toLowerCase().startsWith(text) && it.label.toLowerCase() !== text)
					: af.all.filter((it) => it.label.toLowerCase().includes(text));
			af.active = af.items.length ? 0 : -1;
			af.show();
		};
		af.apply = (items) => {
			af.all = items;
			if (!items.length) return af.hide();
			af.filter();
		};
		af.close = () => {
			af.open = false;
			host.remove();
		};
		af.hide = () => {
			af.close();
			af.req = null;
			af.el = null;
			af.all = [];
			af.items = [];
		};
		af.move = (d) => {
			const count = af.items.length + (af.mode === 'form' ? 0 : 1);
			af.active = (af.active + d + count) % count;
			af.render();
		};
		af.choose = (i) => {
			if (af.mode === 'form') {
				const el = af.el;
				const value = af.items[i] && af.items[i].label;
				af.close();
				if (!el || value === undefined) return;
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
				el.dispatchEvent(new Event('input', { bubbles: true }));
				el.dispatchEvent(new Event('change', { bubbles: true }));
				return;
			}
			af.pick = i === af.items.length ? 'manage' : af.all.indexOf(af.items[i]);
			af.hide();
		};
		// Removing a value takes it out of the list here and asks main to forget it.
		af.remove = (i) => {
			const item = af.items[i];
			if (!item) return;
			af.pick = { remove: item.label };
			af.all = af.all.filter((it) => it !== item);
			if (!af.all.length) return af.close();
			af.filter();
		};
		document.addEventListener(
			'focusin',
			(e) => {
				if (af.isLogin(e.target)) { af.el = e.target; af.mode = 'login'; af.typed = false; af.seq += 1; af.req = { origin: location.origin }; }
				else if (af.fieldName(e.target)) { af.el = e.target; af.mode = 'form'; af.typed = false; af.seq += 1; af.req = { origin: location.origin, field: af.fieldName(e.target) }; }
				else if (e.target !== host) af.hide();
			},
			true
		);
		document.addEventListener('input', (e) => { if (e.isTrusted && e.target === af.el && af.all.length) { af.typed = true; af.filter(); } }, true);
		document.addEventListener(
			'mousedown',
			(e) => {
				if (e.isTrusted && e.target === af.el && !af.open && af.all.length) af.filter();
				else if (af.open && e.target !== host && e.target !== af.el) af.hide();
			},
			true
		);
		document.addEventListener('scroll', () => { if (af.open) af.position(); }, true);
		window.addEventListener('resize', () => { if (af.open) af.position(); });
		window.addEventListener('blur', () => af.hide());
		document.addEventListener(
			'keydown',
			(e) => {
				if (!af.open || !e.isTrusted) return;
				if (e.key === 'ArrowDown') { e.preventDefault(); af.move(1); }
				else if (e.key === 'ArrowUp') { e.preventDefault(); af.move(-1); }
				else if (e.key === 'Enter' && af.active >= 0) { e.preventDefault(); af.choose(af.active); }
				else if (e.key === 'Delete' && e.shiftKey && af.mode === 'form' && af.active >= 0) { e.preventDefault(); af.remove(af.active); }
				else if (e.key === 'Escape') { e.preventDefault(); af.close(); }
				else if (e.key === 'Tab') af.close();
			},
			true
		);
		af.box.addEventListener('mousemove', (e) => {
			const row = e.target.closest('[data-i]');
			if (row && Number(row.dataset.i) !== af.active) { af.active = Number(row.dataset.i); af.render(); }
		});
		af.box.addEventListener('mousedown', (e) => {
			e.preventDefault();
			if (!e.isTrusted) return;
			const del = e.target.closest('[data-del]');
			if (del) return af.remove(Number(del.dataset.del));
			const row = e.target.closest('[data-i]');
			if (row) af.choose(Number(row.dataset.i));
		});
		// When the user sends a form with a password typed in, report the origin, the username field
		// before it and the password to main, sealed with the key only main and this world know.
		const visible = (el) => {
			const r = el.getBoundingClientRect();
			return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
		};
		const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
		af.send = (report) => {
			const data = new TextEncoder().encode(JSON.stringify(report));
			const iv = crypto.getRandomValues(new Uint8Array(12));
			crypto.subtle
				.encrypt({ name: 'AES-GCM', iv }, af.key, data)
				.then((sealed) => console.debug('${CAPTURE_PREFIX}' + b64(iv) + '.' + b64(new Uint8Array(sealed))))
				.catch(() => {});
		};
		af.capture = () => {
			if (!af.key) return;
			const inputs = [...document.querySelectorAll('input')].filter(visible);
			const password = inputs.find((el) => el.type === 'password' && el.value);
			if (!password) return;
			const username = inputs
				.slice(0, inputs.indexOf(password))
				.reverse()
				.find((el) => ['text', 'email', 'tel', ''].includes(el.type) && el.value);
			af.send({ o: location.origin, u: username ? username.value : '', p: password.value });
		};
		// A form sent without a password: its ordinary fields' values, for form history.
		af.captureForm = (scope) => {
			if (!af.key || !scope) return;
			const inputs = scope instanceof HTMLInputElement ? [scope] : [...scope.querySelectorAll('input')];
			if (inputs.some((el) => el.type === 'password' && el.value)) return;
			const f = inputs
				.filter(visible)
				.map((el) => [af.fieldName(el), el.value.trim()])
				.filter(([name, value]) => name && value && value.length <= 200);
			if (f.length) af.send({ o: location.origin, f });
		};
		document.addEventListener('submit', (e) => { if (e.isTrusted) { af.capture(); af.captureForm(e.target); } }, true);
		document.addEventListener(
			'click',
			(e) => {
				const button = e.isTrusted && e.target.closest && e.target.closest('button,input[type=submit]');
				if (button && button.type === 'submit') { af.capture(); af.captureForm(button.form); }
			},
			true
		);
		document.addEventListener(
			'keydown',
			(e) => {
				if (e.isTrusted && e.key === 'Enter' && e.target instanceof HTMLInputElement && !af.open) {
					af.capture();
					af.captureForm(e.target.form || e.target);
				}
			},
			true
		);
	}
	const af = window.__kucedrAutofill;
	const payload = payloadJson ? JSON.parse(payloadJson) : null;
	if (payload && payload.k && !af.key && crypto.subtle) {
		const raw = Uint8Array.from(atob(payload.k), (c) => c.charCodeAt(0));
		crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']).then((key) => { af.key = key; }, () => {});
	}
	if (payload && payload.items && payload.seq === af.seq) af.apply(payload.items);
	const pick = af.pick;
	af.pick = null;
	return JSON.stringify({ seq: af.seq, origin: af.req && af.req.origin, field: af.req && af.req.field, pick, keyed: Boolean(af.key) });
})`;

interface State {
	seq: number;
	origin: string | null;
	pick: number | 'manage' | null;
	keyed: boolean;
}

const lastSeq = new WeakMap<BrowserTab, number>();
const shownItems = new WeakMap<BrowserTab, string[]>();

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
	if (!state.keyed) {
		tab.captureKey ??= randomBytes(32);
		await probe(tab, JSON.stringify({ k: tab.captureKey.toString('base64') })).catch(() => undefined);
	}
	if (state.pick === 'manage') {
		tab.host?.webContents.send(BrowserChannels.managePasswords, null);
		return;
	}
	if (state.pick !== null) {
		const chosen = shownItems.get(tab)?.[state.pick];
		if (chosen) await fillLogin(tab, chosen).catch(() => undefined);
		return;
	}
	if (state.seq === lastSeq.get(tab)) return;
	lastSeq.set(tab, state.seq);
	const logins = state.origin ? matchLogins(state.origin) : [];
	shownItems.set(tab, logins.map((login) => login.id));
	// Only names and sites go to the page's private world; ids and passwords stay in main.
	const items = logins.map((login) => ({
		label: login.username || hostOf(login.url),
		detail: login.savedFor ? `Saved for ${login.savedFor}` : hostOf(login.url),
	}));
	// push right away so the list appears without waiting for the next poll
	await probe(tab, JSON.stringify({ seq: state.seq, items })).catch(() => undefined);
}

export function resetAutofill(tab: BrowserTab): void {
	lastSeq.delete(tab);
	shownItems.delete(tab);
}
