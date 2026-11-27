import { scoped } from '@/spaces/scoped';

export function stored<T>(key: string, fallback: T, workspace?: string): T {
	try {
		return (JSON.parse(localStorage.getItem(scoped(key, workspace)) ?? 'null') as T | null) ?? fallback;
	} catch {
		return fallback;
	}
}
