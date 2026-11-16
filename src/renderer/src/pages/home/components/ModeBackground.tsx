import { useEffect, useRef, useState, type ReactElement } from 'react';
import { app, type AppThemeData } from '@kucedr/sdk';
import type { AgentModeInfo, AgentRunState } from '../../../../../shared/agent_types';

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
	const [theme, setTheme] = useState<AppThemeData>();
	const [reduced, setReduced] = useState(
		() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
	const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
	const active = modeIds.flatMap((id) => modes.find((mode) => mode.id === id && mode.background) ?? []);

	useEffect(() => {
		let live = true;
		void app.getThemeData().then((next) => live && setTheme(next));
		const unsubscribe = app.onThemeModeChanged(setTheme);
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = (): void => setReduced(query.matches);
		const onVisibility = (): void => setVisible(document.visibilityState === 'visible');
		query.addEventListener('change', onMotion);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			live = false;
			unsubscribe();
			query.removeEventListener('change', onMotion);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, []);

	const post = (frame: HTMLIFrameElement): void => {
		const messages = [
			...(theme ? [{ type: 'theme', colors: theme.colors, dark: theme.isDark }] : []),
			{ type: 'motion', reduced },
			{ type: 'visible', value: visible },
			{ type: 'agent', status },
		];
		for (const message of messages) frame.contentWindow?.postMessage(message, '*');
	};
	const postRef = useRef(post);
	postRef.current = post;
	useEffect(() => {
		for (const frame of frames.current.values()) postRef.current(frame);
	}, [theme, reduced, visible, status]);

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
