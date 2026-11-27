export const ONION_RULES = 'MAP *.onion ~NOTFOUND, MAP *.onion. ~NOTFOUND';

export function onion(hostname: string): boolean {
	return /(^|\.)onion\.*$/i.test(hostname);
}
