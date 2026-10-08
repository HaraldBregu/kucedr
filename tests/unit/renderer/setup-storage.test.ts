import { SETUP_STEPS } from '../../../src/renderer/src/pages/start/setupConstants';

it('sets up model providers, chat, then voice', () => {
	expect(SETUP_STEPS).toEqual(['modelProvider', 'chat', 'voice']);
});
