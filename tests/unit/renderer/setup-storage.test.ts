import { SETUP_STEPS } from '../../../src/renderer/src/pages/start/setupConstants';

it('sets up plugins, model providers, chat, then voice', () => {
	expect(SETUP_STEPS).toEqual(['plugins', 'modelProvider', 'chat', 'voice']);
});
