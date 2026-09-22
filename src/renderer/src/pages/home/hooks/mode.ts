import { useCallback, useState } from 'react';
import type { AgentInteractionMode } from '@/lib/compat';

const STORAGE_KEY = 'kucedr-interaction-modes';

function readModes(): Record<string, AgentInteractionMode> {
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
		if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter((entry): entry is [string, AgentInteractionMode] =>
				entry[1] === 'default' || entry[1] === 'plan'
			)
		);
	} catch {
		return {};
	}
}

function writeModes(modes: Record<string, AgentInteractionMode>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
	} catch {
		/* empty */
	}
}

export function useInteractionMode(sessionId: string) {
	const [modes, setModes] = useState<Record<string, AgentInteractionMode>>(readModes);
	const interactionMode = modes[sessionId] ?? 'default';

	const setInteractionMode = useCallback(
		(mode: AgentInteractionMode): void => {
			setModes((current) => {
				const next = { ...current, [sessionId]: mode };
				writeModes(next);
				return next;
			});
		},
		[sessionId]
	);

	const migrateInteractionMode = useCallback(
		(resolvedSessionId: string): void => {
			if (resolvedSessionId === sessionId) return;
			setModes((current) => {
				const next = { ...current };
				const mode = next[sessionId] ?? interactionMode;
				next[resolvedSessionId] = mode;
				writeModes(next);
				return next;
			});
		},
		[interactionMode, sessionId]
	);

	const finishInteractionModeMigration = useCallback(
		(resolvedSessionId: string): void => {
			if (resolvedSessionId === sessionId) return;
			setModes((current) => {
				const next = { ...current };
				delete next[sessionId];
				next[resolvedSessionId] ??= interactionMode;
				writeModes(next);
				return next;
			});
		},
		[interactionMode, sessionId]
	);

	return {
		interactionMode,
		setInteractionMode,
		migrateInteractionMode,
		finishInteractionModeMigration,
	};
}
