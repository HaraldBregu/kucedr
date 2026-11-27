import type { WebContents } from 'electron';

const AUTO_ATTACH = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };

// Tor tabs report UTC, en-US and the session's user agent in the page, its frames and its
// workers. A frame or worker is held until that is set; service workers and other targets are
// never started. Resolves once the overrides are in place, after a blank first page.
export async function disguise(contents: WebContents): Promise<void> {
	const send = (method: string, params: object, session?: string): Promise<unknown> =>
		contents.debugger.sendCommand(method, params, session);
	const agent = { userAgent: contents.session.getUserAgent(), acceptLanguage: 'en-US,en' };
	const apply = (session?: string): Promise<unknown> =>
		Promise.all([
			send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' }, session),
			send('Emulation.setLocaleOverride', { locale: 'en-US' }, session),
			send('Emulation.setUserAgentOverride', agent, session),
		]);
	contents.debugger.on('message', (_event, method, params) => {
		if (method !== 'Target.attachedToTarget') return;
		const { sessionId, targetInfo } = params as { sessionId: string; targetInfo: { type: string } };
		const set =
			targetInfo.type === 'iframe'
				? apply(sessionId)
				: targetInfo.type === 'worker'
					? send('Emulation.setUserAgentOverride', agent, sessionId)
					: Promise.reject(new Error(targetInfo.type));
		void Promise.all([set, send('Target.setAutoAttach', AUTO_ATTACH, sessionId)])
			.then(() => send('Runtime.runIfWaitingForDebugger', {}, sessionId))
			.catch(() => undefined);
	});
	await send('Target.setAutoAttach', AUTO_ATTACH);
	const applied = apply();
	await contents.loadURL('about:blank');
	await applied;
	contents.once('did-navigate', () => contents.navigationHistory.clear());
}
