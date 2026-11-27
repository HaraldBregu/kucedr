import { dangerous } from './dangerous';

export function refuse(url: URL): void {
	if (dangerous(url.hostname))
		throw new Error(
			`Blocked: ${url.hostname} is on the bundled list of known malware sites. Only the user can open it, from the warning in the browser pane.`
		);
}
