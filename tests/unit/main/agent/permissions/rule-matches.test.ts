import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ruleMatches } from '../../../../../src/main/agent/permissions/rule_matches';

describe('ruleMatches', () => {
	it('matches a recursive root and descendants without matching prefix siblings or ancestors', () => {
		const rule = { root: '/workspace', recursive: true };
		expect(ruleMatches(rule, '/workspace')).toBe(true);
		expect(ruleMatches(rule, '/workspace/a/b')).toBe(true);
		expect(ruleMatches(rule, '/workspace-copy/a')).toBe(false);
		expect(ruleMatches(rule, '/')).toBe(false);
	});

	it('normalizes traversal and matches a non-recursive rule exactly', () => {
		expect(ruleMatches({ root: '/workspace/private', recursive: true }, '/workspace/sub/../private/a')).toBe(true);
		expect(ruleMatches({ root: '/workspace', recursive: true }, '/workspace/sub/../../outside')).toBe(false);
		expect(ruleMatches({ root: '/workspace/a.txt', recursive: false }, '/workspace/a.txt')).toBe(true);
		expect(ruleMatches({ root: '/workspace/a.txt', recursive: false }, '/workspace/a.txt/b')).toBe(false);
	});

	it('resolves symlinks before matching', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-permission-'));
		const workspace = path.join(root, 'workspace');
		const outside = path.join(root, 'outside');
		fs.mkdirSync(workspace);
		fs.mkdirSync(outside);
		fs.symlinkSync(outside, path.join(workspace, 'linked'));
		expect(ruleMatches({ root: workspace, recursive: true }, path.join(workspace, 'linked', 'a'))).toBe(
			false
		);
	});

	it('supports filesystem-root recursion', () => {
		expect(ruleMatches({ root: '/', recursive: true }, '/workspace/a')).toBe(true);
	});
});
