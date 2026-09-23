import { isUnreadableBinaryError } from '../../../resources/apps/workspace/src/lib/binary';

describe('isUnreadableBinaryError', () => {
	it('recognizes the workspace binary-preview failure', () => {
		expect(
			isUnreadableBinaryError(
				'[IPC Error] agent:workspace:file:read: Error: This binary file cannot be displayed as code.'
			)
		).toBe(true);
	});

	it('leaves unrelated file-read errors visible', () => {
		expect(isUnreadableBinaryError('Unable to read file.')).toBe(false);
	});
});
