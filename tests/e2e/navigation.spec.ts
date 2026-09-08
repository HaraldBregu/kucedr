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
	'/settings/system',
	'/settings/channels',
	'/settings/agent/skills',
	'/settings/providers',
	'/settings/providers/keys',
	'/settings/agent/mcp',
	'/settings/agent/mcp/missing',
	'/settings/providers/transcribe',
	'/settings/providers/voice',
	'/settings/providers/image',
	'/settings/providers/embedding',
	'/settings/providers/video',
	'/settings/providers/music',
	'/settings/providers/search',
	'/settings/agent/rag',
	'/settings/agent/llm-wiki',
	'/settings/agent/tasks',
	'/settings/agent',
	'/settings/coder',
	'/settings/agent/chathistory',
	'/settings/agent/health',
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
	const emptyContent = page
		.getByText('What can I do for you?')
		.locator('xpath=ancestor::*[contains(@class, "pt-20")][1]');
	const composer = editor.locator('xpath=ancestor::*[@data-expanded][1]');
	const attachmentButton = page.getByRole('button', { name: 'Add attachment' });
	const composerWidth = attachmentButton.locator(
		'xpath=ancestor::div[contains(@class, "max-w-2xl")][1]'
	);

	await expect(emptyContent).toHaveCSS('padding-top', '80px');
	await expect(composer).toHaveCSS('height', '50px');
	await expect(attachmentButton).toHaveCSS('width', '40px');
	await expect(attachmentButton).toHaveCSS('height', '40px');
	await expect(attachmentButton.locator('svg')).toHaveCSS('width', '20px');
	await expect(composerWidth).toHaveCSS('max-width', '672px');
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

test('wiki settings renders the complete configuration workflow', async ({
	browserName: _browserName,
}, testInfo) => {
	await page.evaluate(() => {
		window.location.hash = '#/settings/agent/llm-wiki';
	});
	await expect(page.getByRole('heading', { name: 'LLM Wiki', exact: true })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Raw source folder', exact: true })).toBeVisible();
	await expect(
		page.getByRole('textbox', { name: 'Generated wiki folder', exact: true })
	).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Generation frequency' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Run now' })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('wiki-settings.png'), fullPage: true });
	await page.getByText('Settings file', { exact: true }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('switch', { name: 'Enable wiki knowledge' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open folder' })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('wiki-settings-status.png'), fullPage: true });
});


test('Agent resources have icons and open their nested settings pages', async ({ browserName: _browserName }, testInfo) => {
	await app.evaluate(({ BrowserWindow }) => {
		BrowserWindow.getAllWindows()[0].setSize(1100, 850);
	});
	const resources = [
		{ name: 'Skills', path: 'skills', icon: 'sparkles' },
		{ name: 'Tasks', path: 'tasks', icon: 'list-checks' },
		{ name: 'MCP Servers', path: 'mcp', icon: 'plug-zap' },
		{ name: 'Health', path: 'health', icon: 'heart-pulse' },
		{ name: 'Permissions', path: 'permissions', icon: 'shield-check' },
	];
	for (const resource of resources) {
		await page.evaluate(() => { window.location.hash = '#/settings/agent'; });
		const name = new RegExp(resource.name, 'i');
		const sidebarLink = page.locator('[data-slot="settings-sidebar"]').getByRole('link', { name });
		await expect(sidebarLink).toHaveCount(0);
		const role = ['health', 'permissions'].includes(resource.path) ? 'button' : 'link';
		const pageLink = page.locator('[data-slot="settings-workspace"]').getByRole(role, { name });
		await expect(pageLink.locator(`svg.lucide-${resource.icon}`)).toBeVisible();
		await pageLink.click();
		await expect(page).toHaveURL(new RegExp(`#/settings/agent/${resource.path}$`));
		await expect(page.locator('[data-slot="settings-sidebar"]').getByRole('link', { name: 'Agent', exact: true })).toHaveAttribute('aria-current', 'page');
		await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
		await page.getByRole('navigation', { name: 'Settings navigation' }).getByRole('link', { name: 'Agent', exact: true }).click();
	}
	await expect(page.getByRole('heading', { name: 'Agent', exact: true })).toBeVisible();
	await page.locator('[data-slot="settings-workspace"]').getByRole('link', { name: /Skills/ }).scrollIntoViewIfNeeded();
	await page.screenshot({ path: testInfo.outputPath('agent-desktop.png'), fullPage: true });
	await app.evaluate(({ BrowserWindow }) => {
		const window = BrowserWindow.getAllWindows()[0];
		window.setMinimumSize(390, 600);
		window.setSize(390, 800);
	});
	await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
	const skills = page.locator('[data-slot="settings-workspace"]').getByRole('link', { name: /Skills/ });
	await skills.scrollIntoViewIfNeeded();
	await page.screenshot({ path: testInfo.outputPath('agent-narrow.png'), fullPage: true });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('Channels includes provider credentials and the sidebar has bottom spacing', async ({ browserName: _browserName }, testInfo) => {
	await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(1100, 850); });
	await page.evaluate(() => { window.location.hash = '#/settings/channels'; });
	const sidebar = page.locator('[data-slot="settings-sidebar"]');
	await expect(sidebar.getByRole('link', { name: 'Bots', exact: true })).toHaveCount(0);
	await expect(sidebar.getByRole('link', { name: 'Channels', exact: true })).toHaveCount(1);
	await expect(sidebar.getByRole('link', { name: 'Channels', exact: true }).locator('svg.lucide-radio-tower')).toBeVisible();
	await expect(sidebar.locator('.overflow-y-auto')).toHaveCSS('padding-bottom', '16px');
	const discord = page.getByRole('heading', { name: 'Discord', exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
	await discord.getByRole('button', { name: 'Connect', exact: true }).click();
	await discord.getByLabel('Discord API key', { exact: true }).fill('channel-test-token');
	await discord.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(discord.getByRole('button', { name: 'Edit Discord API key' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Discord Bot API/ })).toContainText('Configured');
	expect(await page.evaluate(() => window.provider.getChannel('discord'))).toMatchObject({ id: 'discord', configured: true });
	await page.screenshot({ path: testInfo.outputPath('channels-configuration.png'), fullPage: true });
});
