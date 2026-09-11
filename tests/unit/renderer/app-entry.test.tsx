import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from '@testing-library/react';

jest.mock('../../../src/renderer/src/App', () => ({
	__esModule: true,
	default: jest.fn(),
}));

jest.mock('../../../src/renderer/src/components/app/titlebar/AppShell', () => ({
	AppShell: ({ title }: { title: string }) => <div data-slot="app-shell">{title}</div>,
}));

it('mounts the app shell through the HTML entry point', async () => {
	const renderer = path.resolve(__dirname, '../../../src/renderer');
	const html = new DOMParser().parseFromString(
		readFileSync(path.join(renderer, 'app.html'), 'utf8'),
		'text/html'
	);
	const entry = html.querySelector('script[type="module"]')?.getAttribute('src');
	expect(entry).toBeDefined();
	document.body.innerHTML = '<div id="root"></div>';
	window.location.hash = '#/app/Workspace%20Files';

	await act(async () => {
		await import(path.join(renderer, entry!));
	});

	expect(document.querySelector('#root > [data-slot="app-shell"]')).toHaveTextContent(
		'Workspace Files'
	);
});
