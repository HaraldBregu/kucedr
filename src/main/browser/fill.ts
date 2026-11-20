import type { BrowserTab } from '../agent/tools/web/browser/pane';
import { canFill, secretFor } from './passwords';

// Tags the password field and the username field before it, so each can be focused by
// marker without a selector ever carrying the value.
const LOCATE = `(() => {
	for (const el of document.querySelectorAll('[data-kucedr-fill]')) el.removeAttribute('data-kucedr-fill');
	const visible = (el) => {
		const rect = el.getBoundingClientRect();
		if (!rect.width || !rect.height) return false;
		const style = getComputedStyle(el);
		return style.visibility !== 'hidden' && style.display !== 'none';
	};
	const inputs = [...document.querySelectorAll('input')].filter(visible);
	const password = inputs.find((input) => input.type === 'password');
	if (!password) return false;
	password.setAttribute('data-kucedr-fill', 'password');
	const username = inputs
		.slice(0, inputs.indexOf(password))
		.reverse()
		.find((input) => ['text', 'email', 'tel', ''].includes(input.type));
	if (username) username.setAttribute('data-kucedr-fill', 'username');
	return true;
})()`;

async function type(tab: BrowserTab, which: 'username' | 'password', value: string): Promise<void> {
	const focused = (await tab.view.webContents.executeJavaScript(
		`Boolean(document.querySelector('[data-kucedr-fill="${which}"]')?.focus() ?? document.querySelector('[data-kucedr-fill="${which}"]'))`,
		true
	)) as boolean;
	if (focused) await tab.view.webContents.debugger.sendCommand('Input.insertText', { text: value });
}

// The password is read from the sealed store here and inserted straight into the field.
// It is never returned to the renderer, and the tab is marked so the agent cannot script-read it.
export async function fillLogin(tab: BrowserTab, id: string): Promise<boolean> {
	const login = secretFor(id);
	if (!login) throw new Error('That saved password is no longer available.');
	// Re-check the tab's real address here, not the page's own report, before using the secret.
	if (!canFill(login.url, tab.view.webContents.getURL()))
		throw new Error('This saved password is for a different, secure site.');
	const found = (await tab.view.webContents.executeJavaScript(LOCATE, true)) as boolean;
	if (!found) throw new Error('No password field is visible on this page.');
	if (login.username) await type(tab, 'username', login.username);
	await type(tab, 'password', login.password);
	await tab.view.webContents.executeJavaScript(
		`for (const el of document.querySelectorAll('[data-kucedr-fill]')) el.removeAttribute('data-kucedr-fill')`,
		true
	);
	tab.filled = true;
	return true;
}
