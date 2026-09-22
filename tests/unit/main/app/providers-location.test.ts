import path from 'node:path';
import { providersDir } from '../../../../src/main/models';
import { userDataLocation } from '../../../../src/main/shared/user_data_location';

describe('providersDir', () => {
	it('stores uploaded providers in Kucedr user data', () => {
		expect(providersDir()).toBe(path.join(userDataLocation(), 'providers'));
	});

});
