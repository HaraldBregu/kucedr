import type { BrowserLogin } from './browser_import';

export function loginLabel(login: BrowserLogin): string {
	return `${login.username || login.url}${login.savedFor ? ` · saved for ${login.savedFor}` : ''}`;
}
