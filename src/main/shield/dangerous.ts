import { hosts } from './hosts';

export function dangerous(hostname: string): boolean {
	return hosts().has(
		hostname
			.toLowerCase()
			.replace(/^\[(.*)\]$/, '$1')
			.replace(/\.+$/, '')
	);
}
