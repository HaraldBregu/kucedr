export function validPrefix(value: unknown): value is string {
	return typeof value === 'string' && value.length <= 512 &&
		/^[a-zA-Z0-9_./-]*$/.test(value) &&
		(value === '' || (!value.startsWith('/') && !value.endsWith('/') &&
			value.split('/').every((part) => part !== '.' && part !== '..' && part !== '')));
}
