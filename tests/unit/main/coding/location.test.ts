import path from 'node:path';
jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => '/tmp/coder-location/.kucedr',
}));
import { codingLocation, codingSessionsLocation } from '../../../../src/main/coding/location';

it('keeps coding sessions directly under the dedicated coder directory', () => {
	expect(codingSessionsLocation()).toBe(path.join('/tmp/coder-location/.kucedr', 'coder', 'sessions'));
	expect(codingLocation()).toBe(path.join('/tmp/coder-location/.kucedr', 'coder', 'pi'));
});
