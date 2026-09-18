import { readFileSync } from 'node:fs';
import path from 'node:path';
it('loads the shared navigation bar shell', () => {
	const renderer = path.resolve(__dirname, '../../../src/renderer');
	const html = new DOMParser().parseFromString(
		readFileSync(path.join(renderer, 'app.html'), 'utf8'),
		'text/html'
	);
	expect(html.querySelector('#root')).not.toBeNull();
	expect(html.querySelector('script[src*="AppWindow"]')).not.toBeNull();
});
