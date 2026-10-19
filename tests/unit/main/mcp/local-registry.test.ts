import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configureLocalMcpServer } from '../../../../src/main/mcp/mcp_local_configure';
import { importLocalMcpServers } from '../../../../src/main/mcp/mcp_local_import';
import { listLocalMcpServers } from '../../../../src/main/mcp/mcp_local_list';
import { readLocalMcpServer } from '../../../../src/main/mcp/mcp_local_read';
import { mcpLocalDiscoveryRoots, mcpLocalRoot } from '../../../../src/main/mcp/mcp_local_root';

let temp: string;

beforeEach(() => {
	temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-mcp-'));
});

afterEach(() => {
	fs.rmSync(temp, { recursive: true, force: true });
});

describe('local MCP registry', () => {
	it('uses the expected local server root', () => {
		expect(mcpLocalRoot('/app-data')).toBe(path.resolve('/app-data', 'mcp', 'servers'));
	});

	it('derives local and workspace discovery roots', () => {
		expect(mcpLocalDiscoveryRoots('/app-data')).toEqual([
			path.resolve('/app-data', 'mcp', 'servers'),
			path.resolve(process.cwd(), 'resources', 'plugins', 'kucedr', 'mcp'),
		]);
	});

	it('supports scanning the configured local root and workspace root together', () => {
		const localRoot = path.join(temp, 'servers');
		const workspaceRoot = path.join(temp, 'mcp');

		const localServer = path.join(localRoot, 'from-user');
		fs.mkdirSync(localServer, { recursive: true });
		fs.writeFileSync(
			path.join(localServer, 'mcp.json'),
			JSON.stringify({ id: 'first', command: 'user' })
		);

		const workspaceServer = path.join(workspaceRoot, 'from-workspace');
		fs.mkdirSync(workspaceServer, { recursive: true });
		fs.writeFileSync(
			path.join(workspaceServer, 'mcp.json'),
			JSON.stringify({ id: 'second', command: 'workspace' })
		);

		const result = listLocalMcpServers([localRoot, workspaceRoot]);
		expect(result.servers.map((server) => server.id)).toEqual(['first', 'second']);
		expect(result.diagnostics).toEqual([]);
	});

	it('keeps the first discovered root when duplicate IDs are present', () => {
		const localRoot = path.join(temp, 'servers');
		const workspaceRoot = path.join(temp, 'mcp');

		const localServer = path.join(localRoot, 'duplicate');
		fs.mkdirSync(localServer, { recursive: true });
		fs.writeFileSync(path.join(localServer, 'mcp.json'), JSON.stringify({ command: 'user' }));

		const workspaceServer = path.join(workspaceRoot, 'duplicate');
		fs.mkdirSync(workspaceServer, { recursive: true });
		fs.writeFileSync(
			path.join(workspaceServer, 'mcp.json'),
			JSON.stringify({ command: 'workspace' })
		);

		const result = listLocalMcpServers([localRoot, workspaceRoot]);
		expect(result.servers).toHaveLength(1);
		expect(result.servers[0]?.data.command).toBe('user');
		expect(result.diagnostics).toEqual([]);
	});

	it('reads a portable stdio manifest and resolves its working directory', () => {
		const directory = path.join(temp, 'filesystem');
		fs.mkdirSync(directory);
		fs.writeFileSync(
			path.join(directory, 'mcp.json'),
			JSON.stringify({
				name: 'Filesystem',
				command: 'node',
				args: ['dist/server.js'],
				env: { MODE: 'test' },
				cwd: '.',
			})
		);

		expect(readLocalMcpServer(directory)).toEqual({
			id: 'filesystem',
			source: 'local',
			path: directory,
			data: {
				type: 'stdio',
				command: 'node',
				args: ['dist/server.js'],
				env: { MODE: 'test' },
				cwd: directory,
				name: 'Filesystem',
				require_approval: undefined,
				defer_loading: undefined,
				enabled: undefined,
			},
		});
	});

	it('rescans additions and removals without restarting', () => {
		const root = path.join(temp, 'servers');
		const first = path.join(root, 'first');
		fs.mkdirSync(first, { recursive: true });
		fs.writeFileSync(path.join(first, 'mcp.json'), JSON.stringify({ command: 'first' }));
		expect(listLocalMcpServers(root).servers.map((server) => server.id)).toEqual(['first']);

		const second = path.join(root, 'second');
		fs.mkdirSync(second);
		fs.writeFileSync(path.join(second, 'mcp.json'), JSON.stringify({ command: 'second' }));
		fs.rmSync(first, { recursive: true });
		expect(listLocalMcpServers(root).servers.map((server) => server.id)).toEqual(['second']);
	});

	it('updates local configuration while preserving package-owned manifest values', () => {
		const root = path.join(temp, 'servers');
		const directory = path.join(root, 'configured-demo');
		fs.mkdirSync(directory, { recursive: true });
		fs.writeFileSync(
			path.join(directory, 'mcp.json'),
			JSON.stringify({
				id: 'configured-demo',
				type: 'stdio',
				name: 'Before',
				command: 'node',
				args: ['server.mjs'],
				cwd: '.',
				package_value: 'preserved',
			})
		);

		const result = configureLocalMcpServer(
			'configured-demo',
			{
				type: 'stdio',
				name: 'Configured demo',
				command: 'bun',
				args: ['run', 'server.mjs'],
				env: { DEMO_COMPANY: 'Kucedr Studio', DEMO_TAX_RATE: '22' },
				require_approval: 'always',
				enabled: false,
				cwd: 'runtime',
			},
			root
		);

		expect(result.data).toMatchObject({
			name: 'Configured demo',
			command: 'bun',
			args: ['run', 'server.mjs'],
			env: { DEMO_COMPANY: 'Kucedr Studio', DEMO_TAX_RATE: '22' },
			require_approval: 'always',
			enabled: false,
			cwd: path.join(directory, 'runtime'),
		});
		expect(JSON.parse(fs.readFileSync(path.join(directory, 'mcp.json'), 'utf8'))).toMatchObject({
			id: 'configured-demo',
			type: 'stdio',
			cwd: 'runtime',
			package_value: 'preserved',
		});
		expect(
			JSON.parse(fs.readFileSync(path.join(directory, 'mcp.json'), 'utf8'))
		).not.toHaveProperty('env');
		expect(fs.readdirSync(directory).filter((entry) => entry.startsWith('.mcp-'))).toEqual([]);
	});

	it('imports a workspace MCP server before writing a local configuration', () => {
		const originalCwd = process.cwd();
		process.chdir(temp);
		try {
			const workspaceServerRoot = path.join(temp, 'resources', 'mcp');
			const packageServer = path.join(workspaceServerRoot, 'gmail-smtp');
			const localRoot = path.join(temp, 'app-data', 'mcp', 'servers');

			fs.mkdirSync(packageServer, { recursive: true });
			fs.writeFileSync(
				path.join(packageServer, 'mcp.json'),
				JSON.stringify({
					id: 'gmail-smtp',
					type: 'stdio',
					command: 'node',
					args: ['--experimental-strip-types', 'src/index.ts'],
					cwd: '.',
					env: { GMAIL_SMTP_HOST: 'smtp.gmail.com' },
				})
			);

			const result = configureLocalMcpServer(
				'gmail-smtp',
				{
					type: 'stdio',
					command: 'node',
					args: ['--experimental-strip-types', 'src/index.ts'],
					env: { GMAIL_SMTP_HOST: 'smtp.gmail.com' },
				},
				localRoot
			);

			const installed = path.join(localRoot, 'gmail-smtp');
			expect(result.path).toBe(installed);
			const installedManifest = JSON.parse(
				fs.readFileSync(path.join(installed, 'mcp.json'), 'utf8')
			);
			expect(installedManifest).toMatchObject({
				id: 'gmail-smtp',
				args: ['--experimental-strip-types', 'src/index.ts'],
			});
			expect(installedManifest).not.toHaveProperty('env');
			expect(fs.existsSync(installed)).toBe(true);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it('does not release a stored environment to a changed command', () => {
		const root = path.join(temp, 'servers');
		const directory = path.join(root, 'bound-environment');
		fs.mkdirSync(directory, { recursive: true });
		fs.writeFileSync(
			path.join(directory, 'mcp.json'),
			JSON.stringify({ id: 'bound-environment', command: 'trusted-command' })
		);
		configureLocalMcpServer(
			'bound-environment',
			{ type: 'stdio', command: 'trusted-command', env: { SECRET: 'value' } },
			root
		);

		fs.writeFileSync(
			path.join(directory, 'mcp.json'),
			JSON.stringify({ id: 'bound-environment', command: 'other-command' })
		);

		expect(readLocalMcpServer(directory).data.env).toBeUndefined();
	});

	it('returns diagnostics for malformed and duplicate manifests', () => {
		const root = path.join(temp, 'servers');
		for (const folder of ['one', 'two']) {
			const directory = path.join(root, folder);
			fs.mkdirSync(directory, { recursive: true });
			fs.writeFileSync(
				path.join(directory, 'mcp.json'),
				JSON.stringify({ id: 'duplicate', command: folder })
			);
		}
		const invalid = path.join(root, 'invalid');
		fs.mkdirSync(invalid);
		fs.writeFileSync(path.join(invalid, 'mcp.json'), '{');

		const result = listLocalMcpServers(root);
		expect(result.servers).toHaveLength(1);
		expect(result.diagnostics.map((diagnostic) => diagnostic.error)).toEqual(
			expect.arrayContaining([
				'mcp.json is not valid JSON.',
				'Another local MCP server already uses ID "duplicate".',
			])
		);
	});

	it('validates before upload and does not overwrite an installed server', () => {
		const source = path.join(temp, 'source');
		const root = path.join(temp, 'installed');
		fs.mkdirSync(source);
		fs.writeFileSync(
			path.join(source, 'mcp.json'),
			JSON.stringify({
				id: 'uploaded',
				command: 'node',
				args: ['server.js'],
				env: { SECRET: 'value' },
				require_approval: 'never',
				enabled: true,
			})
		);

		const first = importLocalMcpServers([source], root);
		expect(first.imported.map((server) => server.id)).toEqual(['uploaded']);
		expect(first.imported[0]?.data).toMatchObject({
			env: { SECRET: 'value' },
			require_approval: 'always',
			enabled: false,
		});
		const installedManifest = JSON.parse(
			fs.readFileSync(path.join(root, 'uploaded', 'mcp.json'), 'utf8')
		);
		expect(installedManifest).toMatchObject({
			require_approval: 'always',
			enabled: false,
		});
		expect(installedManifest).not.toHaveProperty('env');
		expect(first.skipped).toEqual([]);
		const second = importLocalMcpServers([source], root);
		expect(second.imported).toEqual([]);
		expect(second.skipped[0]?.reason).toContain('already exists');
	});
});
