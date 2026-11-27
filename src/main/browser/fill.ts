import type { BrowserTab } from '../agent/tools/web/browser/pane';
import { canFill, secretFor } from './passwords';

// Tags the password field and the username field before it, so each can be focused by
// marker without a selector ever carrying the value. The form is the one holding the field the
// user is in, so a sign-up form elsewhere on the page is left alone; with no field focused it is
// the first sign-in form. A sign-in split over two pages has only one of the two fields.
const LOCATE = `(() => {
	for (const el of document.querySelectorAll('[data-kucedr-fill]')) el.removeAttribute('data-kucedr-fill');
	const visible = (el) => {
		const rect = el.getBoundingClientRect();
		if (!rect.width || !rect.height) return false;
		const style = getComputedStyle(el);
		return style.visibility !== 'hidden' && style.display !== 'none';
	};
	const text = (input) => ['text', 'email', 'tel', ''].includes(input.type);
	const named = (input) =>
		text(input) &&
		(/username|email/.test(input.autocomplete) || input.type === 'email' || /user|login|email|account|identifier/i.test(input.name + ' ' + input.id));
	const fields = (el) => [...(el.form || document).querySelectorAll('input')].filter(visible);
	const before = (el) => {
		const list = fields(el);
		return list.slice(0, list.indexOf(el)).reverse().find(text);
	};
	const all = [...document.querySelectorAll('input')].filter(visible);
	const active = document.activeElement;
	const focused = all.includes(active) && (active.type === 'password' || text(active)) ? active : undefined;
	let password;
	if (focused && focused.type === 'password') password = focused;
	else if (focused) {
		const list = fields(focused);
		password = list.slice(list.indexOf(focused) + 1).find((input) => input.type === 'password');
	} else {
		const passwords = all.filter((input) => input.type === 'password');
		password = passwords.find((input) => input.autocomplete !== 'new-password') || passwords[0];
	}
	const username = password ? before(password) : focused && named(focused) ? focused : focused ? undefined : all.find(named);
	if (username) username.setAttribute('data-kucedr-fill', 'username');
	if (password) password.setAttribute('data-kucedr-fill', 'password');
	return Boolean(username || password);
})()`;

// Selects what the field holds first, so the value replaces it instead of being added to it.
async function type(tab: BrowserTab, which: 'username' | 'password', value: string): Promise<boolean> {
	const focused = (await tab.view.webContents.executeJavaScript(
		`(() => {
			const el = document.querySelector('[data-kucedr-fill="${which}"]');
			if (!el) return false;
			el.focus();
			el.select();
			return true;
		})()`,
		true
	)) as boolean;
	if (focused) await tab.view.webContents.debugger.sendCommand('Input.insertText', { text: value });
	return focused;
}

// The password is read from the sealed store here and inserted straight into the field.
// It is never returned to the renderer, and the tab is marked so the agent cannot script-read it.
export async function fillLogin(tab: BrowserTab, id: string): Promise<boolean> {
	const login = secretFor(id);
	if (!login) throw new Error('That saved password is no longer available.');
	try {
		// Re-check the tab's real address here, not the page's own report, before using the secret.
		if (!canFill(login.url, tab.view.webContents.getURL()))
			throw new Error('This saved password is for a different, secure site.');
		const found = (await tab.view.webContents.executeJavaScript(LOCATE, true)) as boolean;
		if (!found) throw new Error('No sign-in field is visible on this page.');
		if (login.username) await type(tab, 'username', login.username);
		if (await type(tab, 'password', login.password.toString('utf8'))) tab.filled = true;
	} finally {
		login.password.fill(0);
	}
	await tab.view.webContents.executeJavaScript(
		`for (const el of document.querySelectorAll('[data-kucedr-fill]')) el.removeAttribute('data-kucedr-fill')`,
		true
	);
	tab.filled = true;
	return true;
}
