import { createRunContext } from '../../../../../src/main/agent/context';
import { resolvePermission } from '../../../../../src/main/agent/permissions/resolve_permission';
import { mediaAccess } from '../../../../../src/main/agent/permissions/media_access';
import type {
	PermissionRequest,
} from '../../../../../src/main/agent/permissions/permission_resolution';
import type {
	PermissionsSchema,
	ToolAccess,
} from '../../../../../src/main/agent/permissions/permissions_types';
import { resolveWorkspace } from '../../../../../src/main/workspaces/resolve';
import { realPath } from '../../../../../src/main/shared/real_path';
import { builtinCapability } from '../../../../../src/main/agent/execution/capability';

const rule = (root: string, recursive = true) => ({ root, recursive });
const defaults: PermissionsSchema = {
	read: { allow: [rule('/outside')], deny: [] },
	write: { allow: [], deny: [] },
	exec: { allow: [rule('/appdata/agent')], deny: [] },
};
const resolve = (
	access: ToolAccess,
	permissions: PermissionsSchema = defaults,
	options: Partial<PermissionRequest> = {}
) => resolvePermission({ access, permissions, interactive: true, ...options }).mode;

describe('resolvePermission', () => {
	it('uses the given location rules', () => {
		expect(
			resolve({ read: ['/outside/a.txt'] }, { ...defaults, read: { allow: [], deny: [rule('/outside')] } })
		).toBe('deny');
	});

	it('allows interactive reads anywhere and asks for untrusted writes', () => {
		expect(resolve({ read: ['/outside/a.txt'] })).toBe('allow');
		expect(resolve({ read: ['/untrusted/a.txt'] })).toBe('allow');
		expect(resolve({ write: ['/outside/a.txt'] })).toBe('ask');
		expect(resolve({})).toBe('allow');
	});

	it('denies untrusted access when the run is unattended', () => {
		expect(resolve({ read: ['/untrusted/a.txt'] }, defaults, { interactive: false })).toBe('deny');
		expect(resolve({ read: ['/outside/a.txt'] }, defaults, { interactive: false })).toBe('allow');
	});

	it('honors a per-tool deny and keeps location rules for a per-tool allow', () => {
		expect(resolve({ read: ['/outside/a.txt'] }, defaults, { setting: 'deny' })).toBe('deny');
		expect(resolve({ write: ['/outside/a.txt'] }, defaults, { setting: 'allow' })).toBe('ask');
	});

	it('keeps deny precedence over allow and contextual reuse', () => {
		const permissions = {
			...defaults,
			read: { allow: [rule('/repo')], deny: [rule('/repo/private')] },
		};
		const context = createRunContext().fileAccess;
		context.readDirectories.add('/repo/private');

		expect(resolve({ read: ['/repo/public/a.txt'] }, permissions, { interactive: false })).toBe(
			'allow'
		);
		expect(resolve({ read: ['/repo/private/a.txt'] }, permissions, { context })).toBe('deny');
	});

	it('checks command roots against every blocked kind and asks for untrusted roots', () => {
		const permissions = {
			...defaults,
			write: { allow: [], deny: [rule('/appdata/agent/private')] },
			exec: { allow: [rule('/appdata/agent'), rule('/shared')], deny: [] },
		};

		expect(resolve({ read: ['/outside'], exec: ['/shared'] }, permissions)).toBe('allow');
		expect(resolve({ read: ['/appdata/agent'], exec: ['/appdata/agent/private'] }, permissions)).toBe(
			'deny'
		);
		expect(resolve({ read: ['/appdata/agent'], exec: ['/elsewhere'] }, permissions)).toBe('ask');
		expect(resolve({ exec: ['/appdata/agent'], host: true }, permissions)).toBe('ask');
	});

	it('keeps an explicit deny rule for managed targets', () => {
		const denyWrites = { ...defaults, write: { allow: [], deny: [rule('/')] } };

		expect(resolve({ write: ['/appdata/tasks.json'], managed: true }, denyWrites)).toBe('deny');
		expect(resolve({ write: ['/appdata/tasks.json'], managed: true }, defaults, { interactive: false })).toBe(
			'allow'
		);
	});

	it('allows media output in the library and asks for an untrusted directory', () => {
		expect(resolve(mediaAccess(undefined), defaults, { interactive: false })).toBe('allow');
		expect(resolve(mediaAccess('/outside-media'))).toBe('ask');
		expect(
			resolve(mediaAccess(undefined), {
				...defaults,
				write: { allow: [], deny: [rule(realPath(resolveWorkspace('default').library))] },
			})
		).toBe('deny');
		expect(builtinCapability('use_web_browser', { action: 'screenshot' })?.effects).toContain(
			'write'
		);
	});

	it('asks for sensitive tools without persisting them', () => {
		expect(
			resolvePermission({ permissions: defaults, approval: true, interactive: true })
		).toMatchObject({ mode: 'ask', reason: 'sensitive_operation', persistable: false });
	});

	it('denies approval targets that are not literal', () => {
		expect(
			resolvePermission({ access: { exec: ['/Users/me/*'] }, permissions: defaults, interactive: true })
		).toMatchObject({ mode: 'deny', persistable: false });
	});
});
