import { planCommandError } from '../../../../../src/main/agent/plan/command';
import { commandEnvironment } from '../../../../../src/main/agent/execution/environment';

it('does not inherit application credentials into shell commands', () => {
	expect(commandEnvironment({}, { PATH: '/bin', LANG: 'en_US.UTF-8', API_KEY: 'private', NODE_OPTIONS: '--require=payload' })).toEqual({ PATH: '/bin', LANG: 'en_US.UTF-8' });
});

it.each(['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'BASH_ENV', 'ENV', 'ELECTRON_RUN_AS_NODE'])('rejects command overrides of %s before helper startup', (name) => {
	expect(() => commandEnvironment({ [name]: 'payload' }, {})).toThrow('bootstrap variable');
});

it('supports explicitly supplied command environment values', () => {
	expect(commandEnvironment({ BUILD_MODE: 'test' }, { PATH: '/bin' })).toEqual({ PATH: '/bin', BUILD_MODE: 'test' });
});

it('rejects Plan environment overrides before launching its sandbox helper', () => {
	expect(planCommandError({ command: 'pwd', env: { PATH: '/untrusted' } }, '/workspace')).toContain('helper environment');
});
