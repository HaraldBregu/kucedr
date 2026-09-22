const mk = (tag: string) => jest.fn((spec: unknown) => ({ tag, spec }));
const google = mk('google');

jest.mock('../../../../src/main/models/adapters/tti/tti_bfl', () => ({ createBflImageAdapter: mk('bfl') }));
jest.mock('../../../../src/main/models/adapters/tti/tti_google', () => ({ createGoogleImageAdapter: google }));
jest.mock('../../../../src/main/models/adapters/tti/tti_ideogram', () => ({ createIdeogramImageAdapter: mk('id') }));
jest.mock('../../../../src/main/models/adapters/tti/tti_luma', () => ({ createLumaImageAdapter: mk('luma') }));
jest.mock('../../../../src/main/models/adapters/tti/tti_qwen', () => ({ createQwenImageAdapter: mk('qwen') }));
jest.mock('../../../../src/main/models/adapters/tti/tti_stability', () => ({ createStabilityImageAdapter: mk('stab') }));
jest.mock('../../../../src/main/models/adapters/tti/tti_xai', () => ({ createXaiImageAdapter: mk('xai') }));

import { buildImageAdapter } from '../../../../src/main/models/adapters/tti/tti_factory';
import { ImageProviderUnsupportedError } from '../../../../src/main/models/adapters/tti/tti_errors';
import type { ImageProviderSpec } from '../../../../src/main/models/adapters/tti/tti_types';

function spec(id: string): ImageProviderSpec {
	return { id, apiKey: 'k' } as ImageProviderSpec;
}

describe('buildImageAdapter', () => {
	it('dispatches to the matching adapter', () => {
		const result = buildImageAdapter(spec('Google')) as unknown as { tag: string };
		expect(result.tag).toBe('google');
		expect(google).toHaveBeenCalledWith(expect.objectContaining({ id: 'google' }));
	});

	it('rejects midjourney with an explanatory message', () => {
		expect(() => buildImageAdapter(spec('midjourney'))).toThrow(/does not expose a public API/);
	});

	it('throws for unknown providers', () => {
		expect(() => buildImageAdapter(spec('nope'))).toThrow(ImageProviderUnsupportedError);
	});
});
