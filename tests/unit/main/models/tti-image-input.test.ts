import { normalizeImageSource } from '../../../../src/shared/image_types';

const source = { base64: 'aGVsbG8=', mimeType: 'image/png' as const };

describe('image source editing adapters', () => {
	it('normalizes supported source images and rejects data URLs', () => {
		expect(normalizeImageSource(source)).toEqual(source);
		expect(() =>
			normalizeImageSource({ ...source, base64: 'data:image/png;base64,aGVsbG8=' })
		).toThrow('Invalid image source data');
	});
});
