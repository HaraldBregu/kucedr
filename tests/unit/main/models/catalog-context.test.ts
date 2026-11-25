import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let catalogDirectory = '';
jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => catalogDirectory,
}));

import { findModel } from '../../../../src/main/models';
import { modelContextWindow } from '../../../../src/shared/model_context';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';

beforeEach(() => {
	catalogDirectory = mkdtempSync(path.join(tmpdir(), 'kucedr-catalog-context-'));
	mkdirSync(path.join(catalogDirectory, 'providers/openai'), { recursive: true });
});

afterEach(() => rmSync(catalogDirectory, { recursive: true, force: true }));

it.each([undefined, 8192])(
	'fills missing user-catalog limits while respecting an explicit %s token limit',
	(limit) => {
		const manifest = readPlugin(path.resolve('resources/plugins/openai'), 'openai', true).provider!;
		const model: any = manifest.models!.find((item: { id: string }) => item.id === 'gpt-5.4-mini');
		delete model.metadata.contextWindow;
		delete model.metadata.contextWindowDocumentationUrl;
		if (limit) model.metadata.inputs.context_window = { maximum: limit };
		writeFileSync(
			path.join(catalogDirectory, 'providers/openai/manifest.json'),
			JSON.stringify(manifest)
		);
		const loaded = findModel('openai', 'llm', 'gpt-5.4-mini');
		expect(modelContextWindow(loaded?.metadata)).toBe(limit ?? 400000);
	}
);
