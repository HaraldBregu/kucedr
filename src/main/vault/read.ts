import { readFileSync } from 'node:fs';
import { unseal } from './unseal';

export function readSealed(file: string): string {
	return unseal(readFileSync(file)).toString('utf8');
}
