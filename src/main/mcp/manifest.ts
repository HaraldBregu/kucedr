import { loadMcps } from '../models';

export function findMcpService(url: string) {
	return loadMcps().find((service) => service.url === url);
}
