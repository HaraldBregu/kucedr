export function onion(hostname: string): boolean {
	return /(^|\.)onion\.*$/i.test(hostname);
}
