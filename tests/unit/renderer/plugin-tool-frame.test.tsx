import { act, render, screen, waitFor } from '@testing-library/react';
import { PluginToolFrame } from '../../../src/renderer/src/components/plugin-tool/Frame';
import type { AppThemeData } from '../../../src/shared/app_types';
import type { PluginToolInfo } from '../../../src/shared/plugin_types';

const tool: PluginToolInfo = {
	name: 'chart',
	title: 'Chart',
	category: 'data',
	version: '1.0.0',
	height: 320,
	plugin: { id: 'bootstrap', name: 'Bootstrap' },
};
const input = { title: 'Sales' };
const theme: AppThemeData = {
	themeMode: 'light',
	isDark: false,
	colors: {
		background: 'var(--app-window-background)',
		'app-window-background': 'oklch(0.92 0.02 88)',
		foreground: '#102030',
		border: '#405060',
		'chart-1': '#19635f',
		'chart-2': '#4e8e65',
	},
};
let themeChanged: (next: AppThemeData) => void;
const unsubscribe = jest.fn();

beforeEach(() => {
	unsubscribe.mockReset();
	Object.defineProperty(window, 'app', {
		configurable: true,
		value: {
			getThemeData: jest.fn().mockResolvedValue(theme),
			onThemeModeChanged: jest.fn((callback: (next: AppThemeData) => void) => {
				themeChanged = callback;
				return unsubscribe;
			}),
		},
	});
	Object.defineProperty(window, 'plugins', {
		configurable: true,
		value: {
			renderTool: jest
				.fn()
				.mockResolvedValue(
					'<!doctype html><html><head></head><body><div id="chart"></div><script>document.querySelector("#chart").textContent="Sales";</script></body></html>'
				),
		},
	});
});

it('passes every SDK theme token into the bundled chart document', async () => {
	render(<PluginToolFrame tool={tool} input={input} />);
	const frame = await screen.findByTitle('Chart');
	const html = frame.getAttribute('srcdoc') ?? '';
	const document = new DOMParser().parseFromString(html, 'text/html');
	const styles = Array.from(document.querySelectorAll('style'))
		.map((style) => style.textContent)
		.join('')
		.replace(/\s+/g, '');

	expect(window.app.getThemeData).toHaveBeenCalledTimes(1);
	expect(window.plugins.renderTool).toHaveBeenCalledWith('chart', input, 'light');
	for (const [key, value] of Object.entries(theme.colors))
		expect(styles).toContain(`--${key}:${value.replace(/\s+/g, '')}`);
	expect(document.querySelector('#chart')).not.toBeNull();
});

it('keeps script execution isolated from host APIs and network access', async () => {
	render(<PluginToolFrame tool={tool} input={input} />);
	const frame = await screen.findByTitle('Chart');
	const html = frame.getAttribute('srcdoc') ?? '';
	const document = new DOMParser().parseFromString(html, 'text/html');
	const policy = document
		.querySelector('meta[http-equiv="Content-Security-Policy"]')
		?.getAttribute('content');

	expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
	expect(policy).toContain("default-src 'none'");
	expect(policy).toContain("script-src 'unsafe-inline'");
	expect(policy).toContain("style-src 'unsafe-inline'");
	expect(html).not.toMatch(/window\.(?:app|agent|plugins)|contextBridge|ipcRenderer/);
	expect(frame).toHaveStyle({ height: '320px' });
});

it('updates SDK colors when the palette changes without changing mode', async () => {
	render(<PluginToolFrame tool={tool} input={input} />);
	await screen.findByTitle('Chart');
	act(() => themeChanged({ ...theme, colors: { ...theme.colors, 'chart-1': '#ff0088' } }));

	await waitFor(() =>
		expect(screen.getByTitle('Chart').getAttribute('srcdoc')).toContain('#ff0088')
	);
	expect(screen.getByTitle('Chart').getAttribute('srcdoc')).not.toContain('#19635f');
});

it('uses SDK dark mode and unsubscribes when the chart leaves chat', async () => {
	const { unmount } = render(<PluginToolFrame tool={tool} input={input} />);
	await screen.findByTitle('Chart');
	act(() =>
		themeChanged({
			...theme,
			themeMode: 'dark',
			isDark: true,
			colors: { ...theme.colors, foreground: '#eeeeee' },
		})
	);

	await waitFor(() =>
		expect(window.plugins.renderTool).toHaveBeenLastCalledWith('chart', input, 'dark')
	);
	await waitFor(() =>
		expect(screen.getByTitle('Chart').getAttribute('srcdoc')).toContain('#eeeeee')
	);
	unmount();
	expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('shows a readable render failure instead of an empty chart', async () => {
	(window.plugins.renderTool as jest.Mock).mockRejectedValue(new Error('Chart input is invalid.'));
	render(<PluginToolFrame tool={tool} input={input} />);

	expect(await screen.findByText('Chart input is invalid.')).toBeInTheDocument();
	expect(screen.queryByTitle('Chart')).not.toBeInTheDocument();
});
