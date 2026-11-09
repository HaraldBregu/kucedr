export function stored<T>(key: string, fallback: T): T {
	try {
		return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback;
	} catch {
		return fallback;
	}
}
