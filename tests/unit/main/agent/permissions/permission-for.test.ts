import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { permissionFor } from '../../../../../src/main/agent/permissions/permission_for';

describe('permissionFor', () => {
	it('matches a recursive root and descendants without matching prefix siblings or ancestors', () => {
		const rules = { allow: ['/workspace/**'], deny: [] };
		expect(permissionFor(rules, '/workspace', 'exec')).toBe('allow');
		expect(permissionFor(rules, '/workspace/a/b', 'exec')).toBe('allow');
		expect(permissionFor(rules, '/workspace-copy/a', 'exec')).toBeUndefined();
		expect(permissionFor(rules, '/', 'exec')).toBeUndefined();
	});

	it('normalizes traversal and gives deny rules precedence', () => {
		const rules = { allow: ['/workspace/**'], deny: ['/workspace/private/**'] };
		expect(permissionFor(rules, '/workspace/sub/../private/a', 'exec')).toBe('deny');
		expect(permissionFor(rules, '/workspace/sub/../../outside', 'exec')).toBeUndefined();
	});

	it('resolves symlinks before matching', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-permission-'));
		const workspace = path.join(root, 'workspace');
		const outside = path.join(root, 'outside');
		fs.mkdirSync(workspace);
		fs.mkdirSync(outside);
		fs.symlinkSync(outside, path.join(workspace, 'linked'));
		expect(
			permissionFor({ allow: [`${workspace}/**`], deny: [] }, path.join(workspace, 'linked', 'a'), 'exec')
		).toBeUndefined();
	});

	it('supports filesystem-root recursion', () => {
		expect(permissionFor({ allow: ['/**'], deny: [] }, '/workspace/a', 'read')).toBe('allow');
	});
});
