import { planCommandError } from '../../../../../src/main/agent/plan/command';

describe('Plan command policy', () => {
	it('allows inspection commands inside the workspace', () => {
		expect(planCommandError({ command: 'git status', workdir: 'src' }, '/workspace')).toBeUndefined();
	});

	it.each([
		[{ background: true }, 'background'],
		[{ elevated: true }, 'outside the sandbox'],
		[{ pty: true }, 'PTY'],
		[{ host: 'gateway' }, 'external host'],
		[{ additionalRoots: ['/tmp'] }, 'additional roots'],
		[{ workdir: '../outside' }, 'inside the workspace'],
		[{ workdir: '~' }, 'inside the workspace'],
	])('rejects unavailable command input %j', (input, message) => {
		expect(planCommandError(input, '/workspace')).toContain(message);
	});
});
