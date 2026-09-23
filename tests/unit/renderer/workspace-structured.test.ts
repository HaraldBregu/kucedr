import { isStructuredDataPath } from '../../../resources/apps/workspace/src/lib/structured';

describe('isStructuredDataPath', () => {
	it.each(['data.json', 'settings.JSONC', 'workspace.yaml', 'config.yml', 'feed.xml', 'app.toml'])
		('recognizes %s as structured data', (filePath) => {
			expect(isStructuredDataPath(filePath)).toBe(true);
		});

	it.each(['notes.md', 'script.ts', 'image.png'])('does not treat %s as structured data', (filePath) => {
		expect(isStructuredDataPath(filePath)).toBe(false);
	});
});
