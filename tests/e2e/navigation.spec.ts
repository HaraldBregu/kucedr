import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { closeApp } from './close';
import { launchApp } from './helpers';

let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
	({ app, page, userDataDir } = await launchApp());
	await expect(page).toHaveURL(/#\/?start$/);
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
	'/workspace',
	'/settings',
	'/settings/general',
	'/settings/general/persona',
	'/settings/cloud',
	'/settings/general/media/microphone',
	'/settings/channels',
	'/settings/plugins',
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

test('navigation bar gaps stay draggable while buttons remain clickable', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/home';
	});
	const navigationBar = page.locator('[data-slot="navigationbar"]');
	const leftGroup = navigationBar.locator(':scope > div').first();

	await expect(navigationBar).toHaveCSS('-webkit-app-region', 'drag');
	await expect(leftGroup).not.toHaveCSS('-webkit-app-region', 'no-drag');
	await expect(navigationBar.getByRole('button').first()).toHaveCSS(
		'-webkit-app-region',
		'no-drag'
	);
});

test('the navbar Workspace folder button opens the folder sidebar', async () => {
	await page.evaluate(() => {
		window.location.hash = '#/home';
	});
	await page.evaluate(async () => {
		await window.agent.createWorkspaceDirectory('', 'Notes');
		await window.agent.createWorkspaceFile('Notes', 'plan.md');
		await window.agent.writeWorkspaceFile('Notes/plan.md', '# Plan');
		await window.agent.createWorkspaceFile('Notes', 'config.json');
		await window.agent.writeWorkspaceFile('Notes/config.json', '{"enabled": true}');
	});
	const sidebar = page.locator('[data-slot="home-sidebar"]');
	const actions = sidebar.locator('header [data-sidebar="menu-button"]');
	await expect(actions).toHaveCount(1);
	await expect(actions.nth(0)).toContainText('New Chat');
	await expect(actions.nth(0).locator('kbd')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Open Coder' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Open Workspace' })).toHaveCount(0);
	await expect(page.getByRole('group', { name: 'View' })).toHaveCount(0);
	const navigationBar = page.locator('[data-slot="navigationbar"]');
	const searchButton = navigationBar.getByRole('button', { name: 'Search' });
	const workspaceButton = navigationBar.getByRole('button', { name: 'Workspace' });
	await expect(workspaceButton.locator('.lucide-folder')).toBeVisible();
	await expect(searchButton.locator('xpath=following-sibling::button[1][@aria-label="Workspace"]')).toHaveCount(1);
	await workspaceButton.click();
	await expect(page).toHaveURL(/#\/workspace$/);
	await expect(searchButton).toBeVisible();
	const workspaceSidebar = page.locator('[data-slot="workspace-sidebar"]');
	await expect(workspaceSidebar.locator('[data-slot="sidebar-footer"]')).toBeVisible();
	await expect(workspaceSidebar.getByRole('button', { name: /account menu/i })).toBeVisible();
	const workspace = page.getByRole('navigation', { name: 'Workspace files' });
	await expect(workspace.getByText('Notes')).toBeVisible();
	await workspace.getByText('Notes').click();
	await workspace.getByRole('button', { name: 'plan.md' }).click();
	await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Markdown preview editor' })).toHaveAttribute('contenteditable', 'true');
	await page.getByRole('heading', { name: 'Plan' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' draft');
	await expect(page.getByRole('heading', { name: 'Plan draft' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Note content' })).toHaveCount(0);
	const markdownModes = page.getByRole('group', { name: 'Markdown view' });
	await expect.poll(() => markdownModes.getByRole('button', { name: 'Text' }).evaluate((button) => {
		const fill = button.firstElementChild;
		return fill !== null && getComputedStyle(button).borderTopColor === getComputedStyle(fill).backgroundColor;
	})).toBe(true);
	await expect(markdownModes.getByRole('button', { name: 'Raw' })).not.toHaveCSS('border-top-left-radius', '0px');
	await expect(markdownModes.getByRole('button', { name: 'Raw' })).toHaveCSS('border-top-right-radius', '0px');
	await expect(markdownModes.getByRole('button', { name: 'Raw' })).toHaveCSS('border-bottom-right-radius', '0px');
	await expect(markdownModes.getByRole('button', { name: 'Text' })).toHaveCSS('border-top-left-radius', '0px');
	await expect(markdownModes.getByRole('button', { name: 'Text' })).toHaveCSS('border-bottom-left-radius', '0px');
	await expect(markdownModes.getByRole('button', { name: 'Text' })).not.toHaveCSS('border-top-right-radius', '0px');
	await markdownModes.getByRole('button', { name: 'Raw' }).click();
	await expect(markdownModes.getByRole('button', { name: 'Raw' })).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => markdownModes.getByRole('button', { name: 'Raw' }).evaluate((button) => {
		const fill = button.firstElementChild;
		return fill !== null && getComputedStyle(button).borderTopColor === getComputedStyle(fill).backgroundColor;
	})).toBe(true);
	await expect(page.getByRole('textbox', { name: 'Note content' })).toContainText('# Plan draft');
	await expect(page.getByRole('textbox', { name: 'Note content' })).toHaveCSS('padding-left', '0px');
	await expect(page.getByRole('textbox', { name: 'Note content' }).locator('xpath=ancestor::article')).toHaveCSS('padding-top', '32px');
	await page.getByRole('textbox', { name: 'Note content' }).fill('# Revised plan');
	await markdownModes.getByRole('button', { name: 'Text' }).click();
	await expect(markdownModes.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('heading', { name: 'Revised plan' })).toBeVisible();
	await markdownModes.getByRole('button', { name: 'Raw' }).click();
	await page.getByRole('textbox', { name: 'Note content' }).fill('# Saved plan');
	await expect(workspace.getByRole('button', { name: 'plan.md' })).toHaveAttribute('aria-current', 'page');
	const rootFolderButton = page.getByRole('button', { name: 'Browse workspace root' });
	await expect(rootFolderButton).toHaveCSS('margin-right', '0px');
	const folderBackground = await rootFolderButton.evaluate((button) => getComputedStyle(button).backgroundColor);
	await rootFolderButton.hover();
	await expect(rootFolderButton).toHaveCSS('background-color', folderBackground);
	await rootFolderButton.click();
	const breadcrumbTree = page.getByRole('tree', { name: 'Workspace files' });
	const notesFolder = breadcrumbTree.getByRole('treeitem', { name: 'Notes' });
	await expect(notesFolder).toBeFocused();
	await notesFolder.press('ArrowRight');
	await expect(notesFolder).toHaveAttribute('aria-expanded', 'true');
	await notesFolder.press('ArrowDown');
	await expect(breadcrumbTree.getByRole('treeitem', { name: 'config.json' })).toBeFocused();
	await breadcrumbTree.getByRole('treeitem', { name: 'config.json' }).click();
	await expect(breadcrumbTree).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('"enabled": true');
	await expect(workspace.getByRole('button', { name: 'config.json' })).toHaveAttribute('aria-current', 'page');
	await expect.poll(() => page.evaluate(() => window.agent.readWorkspaceFile('Notes/plan.md'))).toBe('# Saved plan');
	await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('"enabled": true');
	await page.evaluate(async () => {
		await window.agent.createWorkspaceFile('Notes', 'updated.md');
	});
	await expect(workspace.getByText('updated.md')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Message Kucedr' })).toHaveCount(0);
	await page.locator('[data-slot="workspace-sidebar"]').getByRole('link', { name: 'Chat' }).click();
	await expect(page).toHaveURL(/#\/home$/);
});

test('Workspace breadcrumbs browse folders and sibling files', async () => {
	const longName = `${'very-long-file-name-'.repeat(9)}.md`;
	await page.evaluate(async (name) => {
		await window.agent.createWorkspaceDirectory('', 'CrumbPicker');
		await window.agent.createWorkspaceDirectory('CrumbPicker', 'Nested');
		await window.agent.createWorkspaceDirectory('CrumbPicker/Nested', 'Sub');
		await window.agent.createWorkspaceFile('CrumbPicker', 'one.md');
		await window.agent.createWorkspaceFile('CrumbPicker/Nested', 'deep.md');
		await window.agent.createWorkspaceFile('CrumbPicker/Nested', 'next.md');
		await window.agent.createWorkspaceFile('CrumbPicker/Nested', name);
		window.location.hash = '#/workspace';
	}, longName);
	const workspace = page.getByRole('navigation', { name: 'Workspace files' });
	await workspace.getByText('CrumbPicker').click();
	await workspace.getByRole('button', { name: 'one.md' }).click();
	await page.getByRole('button', { name: 'Browse CrumbPicker' }).click();
	const folderTree = page.getByRole('tree', { name: 'Workspace files' });
	await expect(folderTree.getByRole('treeitem', { name: 'one.md' })).toBeVisible();
	await folderTree.getByRole('treeitem', { name: 'Nested' }).click();
	await expect(folderTree.getByRole('treeitem', { name: 'deep.md' })).toBeVisible();
	await folderTree.getByRole('treeitem', { name: 'deep.md' }).click();
	await expect(page.getByRole('button', { name: 'Browse deep.md' })).toBeVisible();
	await expect.poll(() => page.evaluate(() => localStorage.getItem('workspace-selected-file'))).toBe('CrumbPicker/Nested/deep.md');
	await page.getByRole('button', { name: 'Browse Nested' }).click();
	const nestedTree = page.getByRole('tree', { name: 'Workspace files' });
	await expect(nestedTree.getByRole('treeitem', { name: 'next.md' })).toBeVisible();
	await expect(nestedTree.getByRole('treeitem', { name: 'Sub' })).toBeVisible();
	await page.keyboard.press('Escape');
	await page.getByRole('button', { name: 'Browse deep.md' }).click();
	const fileTree = page.getByRole('tree', { name: 'Workspace files' });
	await expect(fileTree.getByRole('treeitem')).toHaveCount(3);
	await expect(fileTree.getByRole('treeitem', { name: 'Sub' })).toHaveCount(0);
	await fileTree.getByRole('treeitem', { name: 'next.md' }).click();
	await expect(page.getByRole('button', { name: 'Browse next.md' })).toBeVisible();
	await expect.poll(() => page.evaluate(() => localStorage.getItem('workspace-selected-file'))).toBe('CrumbPicker/Nested/next.md');
	await page.getByRole('button', { name: 'Browse next.md' }).click();
	await page.getByRole('tree', { name: 'Workspace files' }).getByRole('treeitem', { name: longName }).click();
	const filenameButton = page.getByRole('button', { name: `Browse ${longName}` });
	await expect(filenameButton).toHaveCSS('white-space', 'normal');
	await expect.poll(() => filenameButton.evaluate((button) => button.scrollWidth <= button.clientWidth)).toBe(true);
});

test('Workspace keeps its files and selection across chat navigation and refreshes changed content', async () => {
	await page.evaluate(() => { window.location.hash = '#/home'; });
	await page.evaluate(async () => {
		await window.agent.createWorkspaceDirectory('', 'Return');
		await window.agent.createWorkspaceFile('Return', 'state.json');
		await window.agent.writeWorkspaceFile('Return/state.json', '{"current": 1}');
	});
	await page.locator('[data-slot="navigationbar"]').getByRole('button', { name: 'Workspace' }).click();
	const workspace = page.getByRole('navigation', { name: 'Workspace files' });
	await workspace.getByText('Return').click();
	await workspace.getByRole('button', { name: 'state.json' }).click();
	await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('"current": 1');
	const fileInformation = page.locator('footer[aria-label="File information"]');
	await expect(fileInformation).toContainText('Created');
	const footerBeforeRefresh = await fileInformation.textContent();
	await expect.poll(() => page.evaluate(() => localStorage.getItem('workspace-selected-file'))).toBe('Return/state.json');
	await page.reload();
	await expect(workspace.getByRole('button', { name: 'state.json' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('"current": 1');
	await expect(fileInformation).toHaveText(footerBeforeRefresh ?? '');
	await page.locator('[data-slot="workspace-sidebar"]').getByRole('link', { name: 'Chat' }).click();
	await page.locator('[data-slot="navigationbar"]').getByRole('button', { name: 'Workspace' }).click();
	await expect(workspace.getByRole('button', { name: 'state.json' })).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('"current": 1');
	await expect(workspace.getByText('Loading files…')).toHaveCount(0);
	await page.locator('[data-slot="workspace-sidebar"]').getByRole('link', { name: 'Chat' }).click();
	await page.evaluate(async () => {
		await new Promise<void>((resolve, reject) => {
			const unsubscribe = window.agent.onWorkspaceChanged((event) => {
				if (event.type === 'change' && event.path === 'Return/state.json') {
					unsubscribe();
					resolve();
				}
			});
			window.agent.writeWorkspaceFile('Return/state.json', '{"current": 2}').catch(reject);
		});
	});
	await page.locator('[data-slot="navigationbar"]').getByRole('button', { name: 'Workspace' }).click();
	await expect(page.getByRole('textbox', { name: 'Code editor' })).toContainText('"current": 2');
});

test('Workspace releases its mounted UI before navigating from Home to Settings', async () => {
	await page.evaluate(() => { window.location.hash = '#/workspace'; });
	await expect(page.locator('[data-slot="workspace-sidebar"]')).toBeVisible();
	await page.locator('[data-slot="workspace-sidebar"]').getByRole('link', { name: 'Chat' }).click();
	await expect(page.locator('[data-slot="workspace-sidebar"]')).toHaveCount(0);
	await page.locator('[data-slot="navigationbar"]').getByRole('button', { name: 'Settings', exact: true }).click();
	await expect(page.locator('[data-slot="settings-workspace"]')).toBeVisible();
	await expect(page.locator('[data-slot="workspace-content"]')).toHaveCount(0);
});

test('editing Markdown Preview keeps table and task content', async () => {
	const markdown = '# Notes\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- [x] Done';
	await page.evaluate(async (content) => {
		await window.agent.createWorkspaceFile('', 'formatted.md');
		await window.agent.writeWorkspaceFile('formatted.md', content);
		window.location.hash = '#/workspace';
	}, markdown);
	const workspace = page.getByRole('navigation', { name: 'Workspace files' });
	await workspace.getByRole('button', { name: 'formatted.md' }).click();
	await expect(page.getByRole('table')).toBeVisible();
	await expect(page.getByRole('checkbox')).toBeChecked();
	await page.getByRole('heading', { name: 'Notes' }).click();
	await page.keyboard.press('End');
	await page.keyboard.type(' updated');
	await page.getByRole('group', { name: 'Markdown view' }).getByRole('button', { name: 'Raw' }).click();
	await expect(page.getByRole('textbox', { name: 'Note content' })).toContainText('| A | B |');
	await expect(page.getByRole('textbox', { name: 'Note content' })).toContainText('- [x] Done');
	await expect(page.getByRole('textbox', { name: 'Note content' })).toContainText('# Notes updated');
	await expect.poll(() => page.evaluate(() => window.agent.readWorkspaceFile('formatted.md'))).toContain('# Notes updated');
	await expect.poll(() => page.evaluate(() => window.agent.readWorkspaceFile('formatted.md'))).toContain('- [x] Done');
});

test('Markdown comments stay in Source editing mode', async () => {
	await page.evaluate(async () => {
		await window.agent.createWorkspaceFile('', 'comments.md');
		await window.agent.writeWorkspaceFile('comments.md', '# Comments\n\n<!-- keep this -->');
		window.location.hash = '#/workspace';
	});
	await page.getByRole('navigation', { name: 'Workspace files' }).getByRole('button', { name: 'comments.md' }).click();
	await expect(page.getByText('This file contains Markdown comments. Edit it in Source to preserve them.')).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Markdown preview editor' })).toHaveCount(0);
	await page.getByRole('group', { name: 'Markdown view' }).getByRole('button', { name: 'Raw' }).click();
	await expect(page.getByRole('textbox', { name: 'Note content' })).toContainText('<!-- keep this -->');
});

test('a new empty Markdown file opens in editable Preview', async () => {
	await page.evaluate(async () => {
		await window.agent.createWorkspaceFile('', 'empty-note.md');
		window.location.hash = '#/workspace';
	});
	await page.getByRole('navigation', { name: 'Workspace files' }).getByRole('button', { name: 'empty-note.md' }).click();
	await expect(page.getByRole('textbox', { name: 'Markdown preview editor' })).toBeVisible();
	await expect(page.getByText('This page crashed')).toHaveCount(0);
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
	const composer = editor.locator('xpath=ancestor::*[@data-expanded][1]');
	const field = page.locator('[data-slot="prompt-input-field"]');
	const controls = page.locator('[data-slot="prompt-input-controls"]');
	const controlButtons = page.locator('[data-slot="prompt-input-control-buttons"]');
	const attachmentButton = page.getByRole('button', { name: 'Add attachment' });
	const sendButton = field.getByRole('button', { name: 'Send message' });
	const transcriptionButton = field.getByRole('button', { name: /speech-to-text provider/ });
	const modelButton = page.getByRole('button', { name: 'Change model' });

	await expect(field).toHaveCSS('min-height', '104px');
	await expect(field).toHaveCSS('padding-right', '8px');
	await expect(editorArea).toHaveCSS('min-height', '24px');
	await expect(field).toHaveCSS('border-radius', '24px');
	await expect(composer).toHaveCSS('border-radius', '24px');
	await expect(controls).toBeVisible();
	await expect(controlButtons).toHaveCSS('display', 'flex');
	await expect(controls.getByRole('status', { name: 'Kucedr is responding' })).toHaveCount(0);
	expect(
		await controls.evaluate((element) => element.parentElement?.dataset.slot)
	).toBe('prompt-input-field');
	await expect(controls.getByRole('button', { name: 'Add attachment' })).toBeVisible();
	await expect(attachmentButton).toHaveCSS('width', '36px');
	await expect(attachmentButton).toHaveCSS('height', '36px');
	await expect(attachmentButton.locator('svg')).toHaveCSS('width', '16px');
	await expect(controls.getByText('Auto', { exact: true })).toHaveCount(0);
	await expect(modelButton).toContainText('GPT-5.6 Luna');
	await expect(modelButton.locator('svg')).toHaveCount(1);
	await expect(modelButton).toHaveCSS('height', '36px');
	await expect(modelButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(composer).toHaveAttribute('data-expanded', 'false');
	await expect(sendButton).toBeVisible();
	await expect(field.getByRole('button', { name: 'Start voice conversation' })).toHaveCount(0);
	await expect(transcriptionButton).toHaveCSS('width', '36px');
	await expect(transcriptionButton).toHaveCSS('height', '36px');
	const fieldBounds = await field.boundingBox();
	const transcriptionBounds = await transcriptionButton.boundingBox();
	const attachmentBounds = await attachmentButton.boundingBox();
	expect(fieldBounds && transcriptionBounds && attachmentBounds).toBeTruthy();
	expect(transcriptionBounds!.y).toBeGreaterThanOrEqual(fieldBounds!.y);
	expect(transcriptionBounds!.y).toBeGreaterThan(fieldBounds!.y + fieldBounds!.height / 2);
	expect(attachmentBounds!.y).toBeGreaterThan(fieldBounds!.y);
	expect(attachmentBounds!.y + attachmentBounds!.height).toBeLessThanOrEqual(
		fieldBounds!.y + fieldBounds!.height
	);
	expect((await modelButton.boundingBox())!.x).toBeGreaterThan(attachmentBounds!.x);
	await editor.pressSequentially('Hello');
	await expect(editor).toContainText('Hello');
	await expect(composer).toHaveAttribute('data-expanded', 'true');
	await expect(sendButton).toBeVisible();
	await expect(sendButton).toBeEnabled();
	const sendBounds = await sendButton.boundingBox();
	const expandedTranscriptionBounds = await transcriptionButton.boundingBox();
	expect(sendBounds && expandedTranscriptionBounds).toBeTruthy();
	expect(sendBounds!.x).toBeGreaterThan(fieldBounds!.x);
	expect(sendBounds!.y).toBeGreaterThanOrEqual(fieldBounds!.y);
	expect(expandedTranscriptionBounds!.x).toBeLessThan(sendBounds!.x);
	await expect(field).toHaveCSS('min-height', '128px');
	await expect(field).toHaveCSS('padding-top', '12px');
	await expect(field).toHaveCSS('padding-bottom', '8px');
	await expect(field).toHaveCSS('padding-right', '8px');
	await expect(field).toHaveCSS('border-radius', '24px');
	const expandedFieldBounds = await field.boundingBox();
	const expandedEditorBounds = await editor.boundingBox();
	expect(expandedFieldBounds && expandedEditorBounds).toBeTruthy();
	expect(expandedEditorBounds!.y - expandedFieldBounds!.y).toBeGreaterThanOrEqual(12);
	expect(expandedEditorBounds!.y - expandedFieldBounds!.y).toBeLessThan(20);
	await editor.fill('');
	await expect(composer).toHaveAttribute('data-expanded', 'false');
	await expect(sendButton).toBeVisible();
	await expect(field).toHaveCSS('min-height', '104px');
	await expect(field).toHaveCSS('padding-right', '8px');
	await modelButton.click();
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
