export function storageProviderIdentifier(value: unknown): string {
	if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
		throw new Error('Invalid storage provider identifier.');
	}
	return value;
}
