import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { closeApp } from './close';
import { launchApp } from './helpers';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
	({ app, page, userDataDir } = await launchApp());
	await page.evaluate(async () => {
		await window.agent.setProvider({
			id: 'openai',
			name: 'OpenAI',
			baseUrl: 'https://api.openai.com/v1',
		});
		await window.agent.setModelId('gpt-5.6-luna');
		window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
		window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
	});
	await page.reload();
	await expect(page).toHaveURL(/#\/home$/);
});

test.afterAll(async () => {
	await closeApp(app, userDataDir);
});

/**
 * Every navigable top-level route. The app uses a hash router, so we can drive
 * navigation deterministically regardless of onboarding/IPC state. A route that
 * fails to import or throws on mount is caught by the route ErrorBoundary, which
 * renders "This page crashed" — so its absence is the smoke signal.
 */
const routes = [
	'/start',
	'/home',
	'/settings',
	'/settings/general',
	'/settings/general/persona',
	'/settings/cloud',
	'/settings/general/media/microphone',
	'/settings/channels',
	'/settings/integrations',
	'/settings/skills',
	'/settings/providers',
	'/settings/providers/database',
	'/settings/mcp',
	'/settings/mcp/missing',
	'/settings/providers/transcribe',
	'/settings/providers/search',
	'/settings/agent/rag',
	'/settings/tasks',
	'/settings/agent',
	'/settings/coding',
	'/settings/agent/chathistory',
	'/settings/health',
	'/settings/agent/permissions',
];

for (const route of routes) {
	test(`route ${route} mounts without crashing`, async () => {
		await page.evaluate((hash) => {
			window.location.hash = `#${hash}`;
		}, route);
		// Let the lazy chunk load and the component mount.
		await page.waitForTimeout(500);
		await expect(page.locator('#root')).not.toBeEmpty();
		await expect(page.getByText('This page crashed')).toHaveCount(0);
		await expect(page.getByText('Page not found', { exact: true })).toHaveCount(0);
	});
}

test('the start route redirects configured users to home', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/start';
	});
	await expect(page).toHaveURL(/#\/home$/);
	await expect(page.locator('#root')).not.toBeEmpty();
	await expect(page.getByText('errorBoundary.notFoundTitle')).toHaveCount(0);
});

test('the settings home redirects to General settings', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/settings';
	});
	await expect(page).toHaveURL(/#\/settings\/general$/);
});

test('Command+, opens General settings', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/home';
	});
	await page.keyboard.press('Meta+,');
	await expect(page).toHaveURL(/#\/settings\/general$/);
});

test('the platform shortcut creates a new chat session', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/home';
	});
	await expect(page).toHaveURL(/#\/home$/);
	const previousSessionId = await page.evaluate(() => localStorage.getItem('chat-session-id'));

	await page.keyboard.press(process.platform === 'darwin' ? 'Meta+n' : 'Control+n');

	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('chat-session-id')))
		.not.toBe(previousSessionId);
	await expect(page.getByRole('textbox', { name: 'Message Kucedr' })).toBeFocused();
});

test('the empty home state and composer use the intended spacing', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/home';
	});

	const editor = page.getByRole('textbox', { name: 'Message Kucedr' });
	const editorArea = editor.locator('xpath=..');
	const emptyContent = page
		.getByText('What can I do for you?')
		.locator('xpath=ancestor::*[contains(@class, "pt-20")][1]');
	const composer = editor.locator('xpath=ancestor::*[@data-expanded][1]');
	const field = page.locator('[data-slot="prompt-input-field"]');
	const controls = page.locator('[data-slot="prompt-input-controls"]');
	const controlButtons = page.locator('[data-slot="prompt-input-control-buttons"]');
	const attachmentButton = page.getByRole('button', { name: 'Add attachment' });
	const sendButton = field.getByRole('button', { name: 'Send message' });
	const transcriptionButton = field.getByRole('button', { name: /speech-to-text provider/ });
	const modelButton = page.getByRole('button', { name: 'Change model' });

	await expect(emptyContent).toHaveCSS('padding-top', '80px');
	await expect(field).toHaveCSS('min-height', '56px');
	await expect(field).toHaveCSS('padding-right', '8px');
	await expect(editorArea).toHaveCSS('min-height', '24px');
	await expect(field).toHaveCSS('border-radius', '16px');
	await expect(composer).toHaveCSS('border-radius', '16px');
	await expect(controls).toBeVisible();
	await expect(controlButtons).toHaveCSS('display', 'flex');
	await expect(controlButtons).toHaveCSS('padding-left', '12px');
	await expect(controlButtons).toHaveCSS('padding-right', '12px');
	await expect(controls.getByRole('status', { name: 'Kucedr is responding' })).toHaveCount(0);
	expect(
		await controls.evaluate((element) =>
			element.previousElementSibling?.hasAttribute('data-expanded')
		)
	).toBe(true);
	await expect(controls.getByRole('button', { name: 'Add attachment' })).toBeVisible();
	await expect(attachmentButton).toHaveCSS('width', '20px');
	await expect(attachmentButton).toHaveCSS('height', '20px');
	await expect(attachmentButton.locator('svg')).toHaveCSS('width', '14px');
	await attachmentButton.hover();
	await expect(attachmentButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(controlButtons).toHaveCSS('column-gap', '2px');
	await expect(controls.getByText('Auto', { exact: true })).toHaveCount(0);
	await expect(modelButton).toContainText('GPT-5.6 Luna');
	await expect(modelButton.locator('svg')).toHaveCount(0);
	await expect(modelButton).toHaveCSS('height', '20px');
	await expect(modelButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await modelButton.hover();
	await expect(modelButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(composer).toHaveAttribute('data-expanded', 'false');
	await expect(sendButton).toBeDisabled();
	await expect(field.getByRole('button', { name: 'Start voice conversation' })).toHaveCount(0);
	const fieldBounds = await field.boundingBox();
	const sendBounds = await sendButton.boundingBox();
	const transcriptionBounds = await transcriptionButton.boundingBox();
	const attachmentBounds = await attachmentButton.boundingBox();
	expect(fieldBounds && sendBounds && transcriptionBounds && attachmentBounds).toBeTruthy();
	expect(sendBounds!.x).toBeGreaterThan(fieldBounds!.x);
	expect(sendBounds!.y).toBeGreaterThanOrEqual(fieldBounds!.y);
	expect(transcriptionBounds!.x).toBeLessThan(sendBounds!.x);
	expect(transcriptionBounds!.y).toBeGreaterThanOrEqual(fieldBounds!.y);
	expect(attachmentBounds!.y).toBeGreaterThan(fieldBounds!.y + fieldBounds!.height);
	await editor.pressSequentially('Hello');
	await expect(editor).toContainText('Hello');
	await expect(composer).toHaveAttribute('data-expanded', 'true');
	await expect(sendButton).toBeEnabled();
	await expect(field).toHaveCSS('min-height', '96px');
	await expect(field).toHaveCSS('align-items', 'flex-start');
	await expect(field).toHaveCSS('padding-top', '16px');
	await expect(field).toHaveCSS('padding-bottom', '16px');
	await expect(field).toHaveCSS('padding-right', '16px');
	await expect(field).toHaveCSS('border-radius', '16px');
	const expandedFieldBounds = await field.boundingBox();
	const expandedEditorBounds = await editor.boundingBox();
	expect(expandedFieldBounds && expandedEditorBounds).toBeTruthy();
	expect(expandedEditorBounds!.y - expandedFieldBounds!.y).toBeGreaterThanOrEqual(16);
	expect(expandedEditorBounds!.y - expandedFieldBounds!.y).toBeLessThan(20);
	await editor.fill('');
	await expect(composer).toHaveAttribute('data-expanded', 'false');
	await expect(sendButton).toBeDisabled();
	await expect(field).toHaveCSS('min-height', '56px');
	await expect(field).toHaveCSS('padding-right', '8px');
	await modelButton.click();
	await expect(modelButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	const modelMenu = page.getByRole('menu', { name: 'Change model' });
	const modelPopover = modelMenu.locator('xpath=..');
	await expect(modelMenu).toBeVisible();
	await expect(modelPopover).toHaveCSS('width', '224px');
	await expect(modelPopover).toHaveCSS('max-height', '240px');
	await expect(modelPopover.locator('input')).toHaveCount(0);
	await page.getByRole('menuitemradio', { name: /GPT-5.6 Sol/ }).click();
	await expect.poll(() => page.evaluate(() => window.agent.getModelId())).toBe('gpt-5.6-sol');
	await modelButton.click();
	await page.getByRole('menuitemradio', { name: /GPT-5.6 Luna/ }).click();
	await expect.poll(() => page.evaluate(() => window.agent.getModelId())).toBe('gpt-5.6-luna');
	await expect(page.locator('[data-slot="home-composer-shell"]')).toHaveCSS(
		'padding-bottom',
		'20px'
	);
});

test('the leading /plan command activates Plan mode and requires prompt text', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/home';
	});
	const editor = page.getByRole('textbox', { name: 'Message Kucedr' });
	await editor.pressSequentially('/plan');
	await expect(editor.locator('[data-plan-command]')).toHaveText('Plan');
	await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();

	const selectedSession = await page.evaluate(() => localStorage.getItem('chat-session-id'));
	expect(selectedSession).toBeTruthy();
	await expect
		.poll(() =>
			page.evaluate((sessionId) => {
				const modes = JSON.parse(localStorage.getItem('kucedr-interaction-modes') ?? '{}');
				return modes[sessionId ?? ''];
			}, selectedSession)
		)
		.toBe('plan');
	await editor.pressSequentially('Inspect the current workspace');
	await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
});

test('Agent resources have icons and open their nested settings pages', async ({
	browserName: _browserName,
}, testInfo) => {
	await app.evaluate(({ BrowserWindow }) => {
		BrowserWindow.getAllWindows()[0].setSize(1100, 850);
	});
	const resources = [
		{ name: 'Skills', path: 'skills', icon: 'sparkles' },
		{ name: 'Tasks', path: 'tasks', icon: 'list-checks' },
		{ name: 'MCP Servers', path: 'mcp', icon: 'plug-zap' },
		{ name: 'Health', path: 'health', icon: 'heart-pulse' },
		{ name: 'Permissions', path: 'permissions', icon: 'shield-check' },
		{ name: 'Knowledge Base', path: 'rag', icon: 'library' },
	];
	for (const resource of resources) {
		await page.evaluate(() => {
			window.location.hash = '#/settings/agent';
		});
		const name = new RegExp(resource.name, 'i');
		const sidebarLink = page.locator('[data-slot="settings-sidebar"]').getByRole('link', { name });
		await expect(sidebarLink).toHaveCount(0);
		const role = ['health', 'permissions', 'rag'].includes(resource.path) ? 'button' : 'link';
		const pageLink = page.locator('[data-slot="settings-workspace"]').getByRole(role, { name });
		await expect(pageLink.locator(`svg.lucide-${resource.icon}`)).toBeVisible();
		await pageLink.click();
		await expect(page).toHaveURL(new RegExp(`#/settings/agent/${resource.path}$`));
		await expect(
			page
				.locator('[data-slot="settings-sidebar"]')
				.getByRole('link', { name: 'Agent', exact: true })
		).toHaveAttribute('aria-current', 'page');
		await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
		await page
			.getByRole('navigation', { name: 'Settings navigation' })
			.getByRole('link', { name: 'Agent', exact: true })
			.click();
	}
	await expect(page.getByRole('heading', { name: 'Agent', exact: true })).toBeVisible();
	await page
		.locator('[data-slot="settings-workspace"]')
		.getByRole('link', { name: /Skills/ })
		.scrollIntoViewIfNeeded();
	await page.screenshot({ path: testInfo.outputPath('agent-desktop.png'), fullPage: true });
	await app.evaluate(({ BrowserWindow }) => {
		const window = BrowserWindow.getAllWindows()[0];
		window.setMinimumSize(390, 600);
		window.setSize(390, 800);
	});
	await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
	const skills = page
		.locator('[data-slot="settings-workspace"]')
		.getByRole('link', { name: /Skills/ });
	await skills.scrollIntoViewIfNeeded();
	await page.screenshot({ path: testInfo.outputPath('agent-narrow.png'), fullPage: true });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test('Channels includes provider credentials and the sidebar has bottom spacing', async ({
	browserName: _browserName,
}, testInfo) => {
	await app.evaluate(({ BrowserWindow }) => {
		BrowserWindow.getAllWindows()[0].setSize(1100, 850);
	});
	await page.evaluate(() => {
		window.location.hash = '#/settings/channels';
	});
	const sidebar = page.locator('[data-slot="settings-sidebar"]');
	await expect(sidebar.getByRole('link', { name: 'Bots', exact: true })).toHaveCount(0);
	await expect(sidebar.getByRole('link', { name: 'Channels', exact: true })).toHaveCount(1);
	await expect(
		sidebar.getByRole('link', { name: 'Channels', exact: true }).locator('svg.lucide-radio-tower')
	).toBeVisible();
	await expect(sidebar.locator('.overflow-y-auto')).toHaveCSS('padding-bottom', '16px');
	const telegram = page
		.getByRole('heading', { name: 'Telegram', exact: true })
		.locator('xpath=ancestor::*[@data-slot="card"][1]');
	await telegram.getByRole('button', { name: 'Connect', exact: true }).click();
	await telegram.getByLabel('Bot token', { exact: true }).fill('channel-test-token');
	await telegram.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(telegram.getByRole('button', { name: 'Edit token' })).toBeVisible();
	await expect(telegram).toContainText('Configured');
	await expect(page.getByRole('heading', { name: 'Telegram', exact: true })).toHaveCount(1);
	await expect(
		sidebar
			.locator('[data-slot="split-pane-group"]')
			.filter({ has: page.getByRole('link', { name: 'Channels', exact: true }) })
	).toHaveCSS('border-top-width', '1px');
	expect(await page.evaluate(() => window.provider.getChannel('telegram'))).toMatchObject({
		id: 'telegram',
		configured: true,
	});
	await page.screenshot({
		path: testInfo.outputPath('channels-configuration.png'),
		fullPage: true,
	});
	await telegram.getByRole('link', { name: 'Configuration', exact: true }).click();
	await expect(page).toHaveURL(/#\/settings\/channels\/channelDetail\/telegram$/);
	await expect(page.getByRole('heading', { name: 'Telegram', exact: true })).toBeVisible();
	await page.evaluate(() => {
		window.location.hash = '#/settings/channels';
	});
	await app.evaluate(({ BrowserWindow }) => {
		const win = BrowserWindow.getAllWindows()[0];
		win.setMinimumSize(390, 600);
		win.setSize(390, 800);
	});
	await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
	await telegram.scrollIntoViewIfNeeded();
	await page.screenshot({ path: testInfo.outputPath('channels-narrow.png'), fullPage: true });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test('Database saves and reloads database credentials from Providers', async ({
	browserName: _browserName,
}, testInfo) => {
	await app.evaluate(({ BrowserWindow }) => {
		BrowserWindow.getAllWindows()[0].setSize(1100, 850);
	});
	await page.evaluate(() => {
		window.location.hash = '#/settings/providers/models';
	});
	const sidebar = page.locator('[data-slot="settings-sidebar"]');
	const link = sidebar.getByRole('link', { name: 'Database', exact: true });
	await expect(link.locator('svg.lucide-database')).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/#\/settings\/providers\/database$/);
	await expect(page.getByRole('heading', { name: 'Database', level: 1 })).toBeVisible();
	await page.getByLabel('Pinecone API key', { exact: true }).fill('database-test-key');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Edit Pinecone API key' })).toBeVisible();
	expect(await page.evaluate(() => window.provider.get('pinecone', 'databases'))).toMatchObject({
		id: 'pinecone',
		kind: 'databases',
		configured: true,
	});
	expect(await page.evaluate(() => window.provider.get('pinecone', 'models'))).toBeUndefined();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Edit Pinecone API key' })).toBeVisible();
	await page.getByRole('button', { name: 'Edit Pinecone API key' }).click();
	await expect(page.getByLabel('Pinecone API key', { exact: true })).toHaveValue('');
	await page.getByLabel('Pinecone API key', { exact: true }).fill('database-updated-key');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Edit Pinecone API key' })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('vector-db-desktop.png'), fullPage: true });
	await app.evaluate(({ BrowserWindow }) => {
		const win = BrowserWindow.getAllWindows()[0];
		win.setMinimumSize(390, 600);
		win.setSize(390, 800);
	});
	await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
	await page.screenshot({ path: testInfo.outputPath('vector-db-narrow.png'), fullPage: true });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});
