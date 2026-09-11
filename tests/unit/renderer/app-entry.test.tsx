import { readFileSync } from 'node:fs';
import path from 'node:path';
it('leaves app chrome to the child app', () => {
	const renderer = path.resolve(__dirname, '../../../src/renderer');
	const html = new DOMParser().parseFromString(
		readFileSync(path.join(renderer, 'app.html'), 'utf8'),
		'text/html'
	);
	expect(html.querySelector('#root')).toBeNull();
	expect(html.querySelector('script[src*="AppWindow"]')).toBeNull();
});
