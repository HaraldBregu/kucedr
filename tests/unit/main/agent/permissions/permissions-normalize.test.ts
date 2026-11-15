import { normalizePermissionsSchema } from '../../../../../src/main/agent/permissions/normalize_permissions_schema';

describe('normalizePermissionsSchema', () => {
	it('converts legacy strings to literal rules and deduplicates every bucket', () => {
		expect(
			normalizePermissionsSchema({
				read: { allow: [' /repo/** ', '/repo/**', { root: '/repo', recursive: true }, 42], deny: [] },
				write: { allow: ['/repo/file.txt'], deny: [' /private/** '] },
				exec: { allow: ['/repo/*/build/**'], deny: ['/secret/*.pem'] },
			})
		).toEqual({
			permissions: {
				read: { allow: [{ root: '/repo', recursive: true }], deny: [] },
				write: {
					allow: [{ root: '/repo/file.txt', recursive: false }],
					deny: [{ root: '/private', recursive: true }],
				},
				exec: { allow: [], deny: [{ root: '/secret', recursive: true }] },
			},
			dropped: ['/repo/*/build/**', '/secret/*.pem → /secret'],
		});
	});

	it('returns empty rules for invalid and legacy schemas', () => {
		expect(normalizePermissionsSchema({ tools: {}, directories: [] }).permissions).toEqual({
			read: { allow: [], deny: [] },
			write: { allow: [], deny: [] },
			exec: { allow: [], deny: [] },
		});
	});
});
