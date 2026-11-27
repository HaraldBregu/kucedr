import { isIP } from 'node:net';
import { hosts } from './hosts';

export function sinkhole(): string {
	return [...hosts()]
		.filter((host) => !isIP(host))
		.map((host) => `MAP ${host} ~NOTFOUND, MAP ${host}. ~NOTFOUND`)
		.join(', ');
}
