import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { app, type AppThemeData } from '@kucedr/sdk';
import type { AgentModeInfo, AgentRunState } from '@shared/agent_types';

/** Plugin mode backgrounds in sandboxed frames behind the chat. They only receive theme, motion, visibility and run status. */
export function ModeBackground({
	modes,
	modeIds,
	status,
}: {
	modes: readonly AgentModeInfo[];
	modeIds: readonly string[];
	status: AgentRunState;
}): ReactElement | null {
	const frames = useRef(new Map<string, HTMLIFrameElement>());
	const [tokens, setTokens] = useState<readonly string[]>([]);
	const [themeVersion, setThemeVersion] = useState(0);
	const [reduced, setReduced] = useState(
		() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
	const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
	const active = modeIds.flatMap((id) => modes.find((mode) => mode.id === id && mode.background) ?? []);

	useEffect(() => {
		let live = true;
		const update = (theme: AppThemeData): void => {
			if (live) setTokens(Object.keys(theme.colors));
		};
		void app.getThemeData().then(update);
		const unsubscribe = app.onThemeModeChanged(update);
		const observer = new MutationObserver(() => setThemeVersion((version) => version + 1));
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = (): void => setReduced(query.matches);
		const onVisibility = (): void => setVisible(document.visibilityState === 'visible');
		query.addEventListener('change', onMotion);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			live = false;
			unsubscribe();
			observer.disconnect();
			query.removeEventListener('change', onMotion);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, []);

	const messages = useMemo(() => {
		const style = getComputedStyle(document.documentElement);
		const colors = Object.fromEntries(
			tokens.map((token) => [token, style.getPropertyValue(`--${token}`).trim()])
		);
		const dark = document.documentElement.classList.contains('dark');
		return [
			{ type: 'theme', colors, dark },
			{ type: 'motion', reduced },
			{ type: 'visible', value: visible },
			{ type: 'agent', status },
		];
	}, [tokens, themeVersion, reduced, visible, status]);
	const post = (frame: HTMLIFrameElement): void => {
		for (const message of messages) frame.contentWindow?.postMessage(message, '*');
	};
	useEffect(() => {
		for (const frame of frames.current.values()) {
			for (const message of messages) frame.contentWindow?.postMessage(message, '*');
		}
	}, [messages]);

	if (active.length === 0) return null;
	return (
		<>
			{active.map((mode) => (
				<iframe
					key={mode.id}
					ref={(frame) => {
						if (frame) frames.current.set(mode.id, frame);
						else frames.current.delete(mode.id);
					}}
					src={`kucedr-mode://${mode.id}/index.html`}
					sandbox="allow-scripts"
					aria-hidden
					tabIndex={-1}
					title=""
					onLoad={(event) => post(event.currentTarget)}
					className="pointer-events-none absolute inset-0 -z-10 size-full border-0 bg-transparent"
				/>
			))}
		</>
	);
}
