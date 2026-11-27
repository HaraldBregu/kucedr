import type { WebContents } from 'electron';

const AUTO_ATTACH = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };

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
	await Promise.all([apply(), contents.loadURL('about:blank')]);
	contents.once('did-navigate', () => contents.navigationHistory.clear());
}
