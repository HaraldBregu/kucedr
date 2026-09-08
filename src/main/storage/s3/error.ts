export function throwStorageRequestError(error: unknown): never {
	const name = error instanceof Error ? error.name : '';
	const messages: Record<string, string> = {
		AccessDenied: 'The storage credentials do not have permission to access this bucket.',
		InvalidAccessKeyId: 'The storage access key ID is invalid.',
		SignatureDoesNotMatch: 'The storage credentials or region are incorrect.',
		NoSuchBucket: 'The configured storage bucket was not found.',
		NoSuchKey: 'The backup file was not found in storage.',
		InvalidRegion: 'The configured storage region is invalid.',
	};
	throw new Error(messages[name] ?? 'The S3 request failed. Check the storage provider connection.');
}
