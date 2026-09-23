export function isUnreadableBinaryError(error: string): boolean {
	return error.includes('This binary file cannot be displayed as code.');
}
