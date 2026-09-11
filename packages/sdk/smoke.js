import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
	agent,
	app,
	APP_WINDOW_DEFAULTS,
	coder,
	connect,
	isAppStoreValue,
	isAppWindowSettings,
	isKucedr,
	models,
	terminal,
	win,
} from './dist/packages/sdk/index.js';

assert.deepEqual(APP_WINDOW_DEFAULTS, {
	width: 820,
	height: 640,
	minWidth: 620,
	minHeight: 480,
	resizable: true,
	maximizable: true,
});
assert.equal(isAppWindowSettings({ width: 480, height: 320, resizable: false }), true);
assert.equal(isAppWindowSettings({ width: 480, minWidth: 620 }), false);
assert.equal(isAppWindowSettings({ height: 0 }), false);
assert.equal(isAppWindowSettings({ width: 32769 }), false);
assert.equal(isAppWindowSettings({ maximizable: 'false' }), false);

// --- embedded mode: bound to the app's preload globals ----------------------

assert.equal(isKucedr(), false);
assert.throws(() => app.getTheme, /unavailable/);
assert.throws(() => agent.getWorkspaceLocation, /unavailable/);
assert.throws(() => coder.getSettings, /unavailable/);
assert.throws(() => models.image.createImage, /unavailable/);
assert.throws(() => terminal.create, /unavailable/);
assert.throws(() => win.showContextMenu, /unavailable/);

const appValues = new Map();
const appFiles = new Map();
const workspaceFile = {
	name: 'USER.md',
	path: 'USER.md',
	type: 'file',
	size: 128,
	createdAt: '2026-08-17T10:00:00.000Z',
	updatedAt: '2026-08-18T10:00:00.000Z',
};
globalThis.app = {
	getAppStoreValue: async (key) => appValues.get(key),
	setAppStoreValue: async (key, value) => appValues.set(key, value),
	deleteAppStoreValue: async (key) => appValues.delete(key),
	readAppStoreFile: async (path) => {
		const data = appFiles.get(path);
		if (!data) throw new Error('App file not found.');
		return data;
	},
	writeAppStoreFile: async (path, data) => appFiles.set(path, new Uint8Array(data)),
	deleteAppStoreFile: async (path) => appFiles.delete(path),
	getThemeData: async () => ({
		themeMode: 'system',
		isDark: false,
		colors: { background: '#fff' },
	}),
	getTheme: async () => 'system',
	setTheme: async () => undefined,
	getLanguage: async () => 'en',
	setLanguage: async () => undefined,
	onThemeModeChanged: () => () => undefined,
};
globalThis.agent = {
	getWorkspaceLocation: async () => '/tmp/kucedr-workspace',
	listWorkspaceFiles: async () => [workspaceFile],
	readWorkspaceFile: async (filePath) => `content:${filePath}`,
	readWorkspaceAsset: async () => ({ mimeType: 'image/png', data: new Uint8Array([1, 2, 3]) }),
	writeWorkspaceFile: async () => undefined,
	writeWorkspaceMarkdown: async () => undefined,
	createWorkspaceFile: async (parentPath, name) => [parentPath, name].filter(Boolean).join('/'),
	createWorkspaceDirectory: async (parentPath, name) =>
		[parentPath, name].filter(Boolean).join('/'),
	moveWorkspaceEntry: async (sourcePath, destinationDirectoryPath) =>
		[destinationDirectoryPath, sourcePath.split('/').pop()].filter(Boolean).join('/'),
	renameWorkspaceEntry: async (sourcePath, name) =>
		[...sourcePath.split('/').slice(0, -1), name].filter(Boolean).join('/'),
	deleteWorkspaceFile: async () => undefined,
	deleteWorkspaceDirectory: async () => undefined,
};
const coderSettings = {
	runtime: 'pi',
	providerId: 'openai-codex',
	modelId: 'gpt-5.4',
	thinkingLevel: 'high',
	toolMode: 'coding',
};
const coderProject = {
	id: 'project-1',
	name: 'kucedr-workspace',
	directory: '/tmp/kucedr-workspace',
	kind: 'agent-workspace',
	createdAt: '2026-08-20T10:00:00.000Z',
	lastOpenedAt: '2026-08-20T10:00:00.000Z',
	available: true,
};
const coderInstructions = {
	projectId: coderProject.id,
	activeFilePath: '/tmp/kucedr-workspace/AGENTS.md',
	activeFileName: 'AGENTS.md',
	content: '# Instructions',
	exists: true,
	editable: true,
	revision: 'revision-1',
	loadedSources: [{ path: '/tmp/kucedr-workspace/AGENTS.md', scope: 'workspace' }],
};
globalThis.coder = {
	getSettings: async () => coderSettings,
	saveSettings: async (settings) => settings,
	listModels: async () => ({ providers: [] }),
	listProjects: async () => [coderProject],
	addProject: async () => coderProject,
	openProject: async () => undefined,
	removeProject: async (projectId) => projectId === coderProject.id,
	getProjectInstructions: async () => coderInstructions,
	saveProjectInstructions: async (_projectId, update) => ({
		...coderInstructions,
		content: update.content,
		revision: 'revision-2',
	}),
	listSessions: async () => [],
	getSession: async () => ({
		session: {
			id: 'session-1',
			projectId: coderProject.id,
			title: 'Fix the tests',
			createdAt: '2026-08-20T10:00:00.000Z',
			updatedAt: '2026-08-20T10:00:00.000Z',
			messageCount: 2,
		},
		blocks: [],
	}),
	renameSession: async (projectId, sessionId, title) => ({
		id: sessionId,
		projectId,
		title,
		createdAt: '2026-08-20T10:00:00.000Z',
		updatedAt: '2026-08-20T10:00:00.000Z',
		messageCount: 2,
	}),
	deleteSession: async () => true,
	send: async (request, onEvent) => {
		const context = {
			runId: 'coder-run',
			projectId: request.projectId,
			sessionId: 'session-1',
		};
		onEvent?.({ ...context, type: 'status', status: 'started' });
		onEvent?.({ ...context, type: 'text-delta', delta: 'done' });
		return { projectId: request.projectId, sessionId: 'session-1', output: 'done' };
	},
	cancel: async (runId) => runId === 'coder-run',
	connectCodex: async () => ({ configured: true, type: 'oauth' }),
	cancelCodexLogin: async () => false,
	disconnectCodex: async () => undefined,
};
globalThis.models = {
	image: {
		createImage: async (request) => ({
			base64: request.source?.base64 ?? 'generated',
			mimeType: 'image/png',
		}),
	},
};
globalThis.terminalAPI = {
	create: async (request) => ({
		...request,
		shell: '/bin/zsh',
		cwd: request.cwd ?? '/tmp/kucedr-workspace',
		createdAt: 1,
	}),
	write: () => undefined,
	resize: () => undefined,
	kill: async () => true,
	onData: () => () => undefined,
	onExit: () => () => undefined,
};
globalThis.win = {
	minimize: () => undefined,
	maximize: () => undefined,
	close: () => undefined,
	popupMenu: () => undefined,
	showContextMenu: async (items) => items[0]?.id ?? null,
	isMaximized: async () => true,
	onMaximizeChange: () => () => undefined,
	isFullScreen: async () => false,
	onFullScreenChange: () => () => undefined,
	setTitlebarOptions: (options) => {
		globalThis.__titlebarOptions = options;
	},
	onTitlebarOptionsChanged: () => () => undefined,
	clickTitlebarButton: () => undefined,
	onTitlebarButtonClick: (callback) => {
		globalThis.__titlebarButtonClick = callback;
		return () => {
			globalThis.__titlebarButtonClick = undefined;
		};
	},
	setTitlebarSidebarWidth: () => undefined,
	onTitlebarSidebarWidthChanged: () => () => undefined,
};

assert.equal(isKucedr(), true);
assert.equal(isAppStoreValue({ color: 'blue', sizes: [1, 2] }), true);
assert.equal(isAppStoreValue({ invalid: Number.NaN }), false);
assert.deepEqual(await app.getThemeData(), {
	themeMode: 'system',
	isDark: false,
	colors: { background: '#fff' },
});
await app.setAppStoreValue('config', { color: 'blue' });
assert.deepEqual(await app.getAppStoreValue('config'), { color: 'blue' });
await app.deleteAppStoreValue('config');
assert.equal(await app.getAppStoreValue('config'), undefined);
await app.writeAppStoreFile('assets/data.bin', new Uint8Array([4, 5, 6]));
assert.deepEqual(await app.readAppStoreFile('assets/data.bin'), new Uint8Array([4, 5, 6]));
await app.deleteAppStoreFile('assets/data.bin');
await assert.rejects(app.readAppStoreFile('assets/data.bin'), /not found/);
const writeAppStoreFile = globalThis.app.writeAppStoreFile;
delete globalThis.app.writeAppStoreFile;
assert.throws(
	() => app.writeAppStoreFile,
	/app\.writeAppStoreFile.*update the Kucedr host/
);
globalThis.app.writeAppStoreFile = writeAppStoreFile;
assert.equal(await agent.getWorkspaceLocation(), '/tmp/kucedr-workspace');
assert.deepEqual(await agent.listWorkspaceFiles(), [workspaceFile]);
assert.equal(await agent.readWorkspaceFile('USER.md'), 'content:USER.md');
assert.deepEqual(await agent.readWorkspaceAsset('photo.png'), {
	mimeType: 'image/png',
	data: new Uint8Array([1, 2, 3]),
});
await agent.writeWorkspaceMarkdown('USER.md', '# Updated');
await agent.writeWorkspaceFile('diagram.mmd', 'flowchart LR');
assert.equal(await agent.createWorkspaceFile('', 'draft.md'), 'draft.md');
assert.equal(await agent.createWorkspaceDirectory('notes', 'ideas'), 'notes/ideas');
assert.equal(await agent.moveWorkspaceEntry('draft.md', 'notes'), 'notes/draft.md');
assert.equal(await agent.renameWorkspaceEntry('notes/draft.md', 'idea.md'), 'notes/idea.md');
await agent.deleteWorkspaceFile('old.md');
await agent.deleteWorkspaceDirectory('archive');
assert.deepEqual(await coder.getSettings(), coderSettings);
const coderEvents = [];
assert.deepEqual(await coder.listProjects(), [coderProject]);
assert.deepEqual(await coder.getProjectInstructions(coderProject.id), coderInstructions);
assert.equal(
	(
		await coder.saveProjectInstructions(coderProject.id, {
			content: '# Updated',
			expectedRevision: coderInstructions.revision,
		})
	).content,
	'# Updated'
);
assert.deepEqual(
	await coder.send({ projectId: coderProject.id, mode: 'agent', input: 'Fix the tests' }, (event) =>
		coderEvents.push(event)
	),
	{ projectId: coderProject.id, sessionId: 'session-1', output: 'done' }
);
assert.deepEqual(coderEvents, [
	{
		type: 'status',
		runId: 'coder-run',
		projectId: coderProject.id,
		sessionId: 'session-1',
		status: 'started',
	},
	{
		type: 'text-delta',
		runId: 'coder-run',
		projectId: coderProject.id,
		sessionId: 'session-1',
		delta: 'done',
	},
]);
assert.equal(await coder.cancel('coder-run'), true);
assert.deepEqual(await models.image.createImage({ prompt: 'room' }), {
	base64: 'generated',
	mimeType: 'image/png',
});
assert.deepEqual(
	await models.image.createImage({
		prompt: 'revise room',
		source: { base64: 'aGVsbG8=', mimeType: 'image/png' },
	}),
	{ base64: 'aGVsbG8=', mimeType: 'image/png' }
);
await coder.openProject(coderProject.id);
assert.equal(
	(await coder.renameSession(coderProject.id, 'session-1', 'Focused tests')).title,
	'Focused tests'
);
assert.equal(await coder.deleteSession(coderProject.id, 'session-1'), true);
assert.deepEqual(
	await terminal.create({
		id: 'terminal-coder',
		cwd: coderProject.directory,
		cols: 80,
		rows: 24,
	}),
	{
		id: 'terminal-coder',
		cwd: coderProject.directory,
		cols: 80,
		rows: 24,
		shell: '/bin/zsh',
		createdAt: 1,
	}
);
terminal.write({ id: 'terminal-coder', data: 'pwd\r' });
terminal.resize({ id: 'terminal-coder', cols: 120, rows: 40 });
assert.equal(await terminal.kill({ id: 'terminal-coder' }), true);
assert.equal(await win.showContextMenu([{ id: 'open', label: 'Open' }]), 'open');
assert.equal(await win.isMaximized(), true);
win.setTitlebarOptions({
	title: 'Workspace',
	leftButtons: [
		{
			id: 'toggle-sidebar',
			label: 'Collapse sidebar',
			icon: 'panel-left',
			expanded: true,
		},
	],
	rightButtons: [],
	sidebarOpen: true,
	sidebarWidth: 240,
});
assert.equal(globalThis.__titlebarOptions.title, 'Workspace');
assert.equal(globalThis.__titlebarOptions.sidebarOpen, true);
let titlebarButtonId;
const stopTitlebarButtonClick = win.onTitlebarButtonClick((buttonId) => {
	titlebarButtonId = buttonId;
});
globalThis.__titlebarButtonClick('toggle-sidebar');
assert.equal(titlebarButtonId, 'toggle-sidebar');
stopTitlebarButtonClick();

// --- remote mode: bound to the app API server --------------------------------

const calls = [];
let stream;

const server = createServer(async (req, res) => {
	assert.equal(req.headers.authorization, 'Bearer secret');
	if (req.url === '/health') {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ name: 'kucedr', version: '1.0.0' }));
		return;
	}
	if (req.url === '/events') {
		res.writeHead(200, { 'content-type': 'text/event-stream' });
		res.write(': connected\n\n');
		stream = res;
		return;
	}
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const { channel, args } = JSON.parse(Buffer.concat(chunks).toString());
	calls.push({ channel, args });
	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(
		JSON.stringify({
			success: true,
			data:
				channel === 'agent:workspace:location:get'
					? '/tmp/kucedr-workspace'
					: channel === 'agent:workspace:files:list'
						? [workspaceFile]
						: channel === 'agent:workspace:file:read'
							? `content:${args[0]}`
							: channel === 'agent:workspace:asset:read'
								? { mimeType: 'image/png', data: { $bytes: 'AQID' } }
								: (args[0] ?? null),
		})
	);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const kucedr = connect({ url: `http://127.0.0.1:${server.address().port}`, token: 'secret' });

assert.deepEqual(await kucedr.ping(), { name: 'kucedr', version: '1.0.0' });
assert.throws(() => kucedr.app.getAppStoreValue, /not available over the API/);
await kucedr.app.getThemeData();
assert.equal(await kucedr.agent.getWorkspaceLocation(), '/tmp/kucedr-workspace');
assert.deepEqual(await kucedr.agent.listWorkspaceFiles(), [workspaceFile]);
assert.equal(await kucedr.agent.readWorkspaceFile('USER.md'), 'content:USER.md');
assert.deepEqual(await kucedr.agent.readWorkspaceAsset('photo.png'), {
	mimeType: 'image/png',
	data: new Uint8Array([1, 2, 3]),
});
await kucedr.agent.writeWorkspaceMarkdown('USER.md', '# Updated');
await kucedr.agent.writeWorkspaceFile('diagram.mmd', 'flowchart LR');
await kucedr.agent.createWorkspaceFile('', 'draft.md');
await kucedr.agent.createWorkspaceDirectory('notes', 'ideas');
await kucedr.agent.moveWorkspaceEntry('draft.md', 'notes');
await kucedr.agent.renameWorkspaceEntry('notes/draft.md', 'idea.md');
await kucedr.agent.deleteWorkspaceFile('old.md');
await kucedr.agent.deleteWorkspaceDirectory('archive');

assert.deepEqual(
	calls.map((call) => call.channel),
	[
		'app:get-theme-data',
		'agent:workspace:location:get',
		'agent:workspace:files:list',
		'agent:workspace:file:read',
		'agent:workspace:asset:read',
		'agent:workspace:markdown:write',
		'agent:workspace:file:write',
		'agent:workspace:file:create',
		'agent:workspace:directory:create',
		'agent:workspace:entry:move',
		'agent:workspace:entry:rename',
		'agent:workspace:file:delete',
		'agent:workspace:directory:delete',
	]
);

// events reach subscribers over the stream
const seen = [];
kucedr.app.onChannelsStatusChanged((event) => seen.push(event));
await new Promise((resolve) => setTimeout(resolve, 100));
stream.write(
	`data: ${JSON.stringify({ channel: 'app:channels:status-changed', data: { ok: 1 } })}\n\n`
);
await new Promise((resolve) => setTimeout(resolve, 100));
assert.deepEqual(seen, [{ ok: 1 }]);

kucedr.close();
server.close();
stream?.end();

console.log('sdk smoke ok');
