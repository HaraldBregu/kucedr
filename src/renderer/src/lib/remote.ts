export function isRemoteUrl(url: string): boolean {
	return /^https?:/i.test(url);
}
