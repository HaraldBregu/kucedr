import os from 'node:os';
import path from 'node:path';

import { userDataLocation } from '../../../../src/main/shared/user_data_location';

describe('userDataLocation', () => {
	it('keeps persistent Kucedr data in the user profile', () => {
		const previous = process.env.KUCEDR_E2E_DATA_ROOT;
		delete process.env.KUCEDR_E2E_DATA_ROOT;

		try {
			expect(userDataLocation()).toBe(path.join(os.homedir(), '.kucedr'));
		} finally {
			if (previous !== undefined) process.env.KUCEDR_E2E_DATA_ROOT = previous;
		}
	});

	it('uses the isolated E2E data root when configured', () => {
		const previous = process.env.KUCEDR_E2E_DATA_ROOT;
		process.env.KUCEDR_E2E_DATA_ROOT = './test-data';

		try {
			expect(userDataLocation()).toBe(path.resolve('./test-data'));
		} finally {
			if (previous === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
			else process.env.KUCEDR_E2E_DATA_ROOT = previous;
		}
	});
});
