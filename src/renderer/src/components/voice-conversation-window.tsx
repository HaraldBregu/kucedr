import { useCallback, useEffect } from 'react';
import { Persona, type PersonaState } from '@/components/persona';
import { TypingLoader } from '@/components/ui/loader';
import { cn } from '@/lib/utils';
import { useRealtimeVoice, type RealtimeVoiceUiStatus } from '@/pages/home/hooks/useRealtimeVoice';

const statusLabels: Record<RealtimeVoiceUiStatus, string> = {
	idle: 'Ready',
	'checking-permission': 'Checking microphone…',
	connecting: 'Connecting…',
	listening: 'Listening…',
	thinking: 'Kucedr is responding…',
	speaking: 'Kucedr is speaking…',
	ending: 'Ending…',
	error: 'Voice conversation ended',
};

function formatDuration(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function personaState(status: RealtimeVoiceUiStatus, muted: boolean): PersonaState {
	if (status === 'thinking' || status === 'speaking') return status;
	if (status === 'listening' && !muted) return 'listening';
	return 'idle';
}

export function VoiceConversationWindow({
	chatSessionId,
}: {
	readonly chatSessionId: string;
}): React.JSX.Element {
	const closeWindow = useCallback((): void => {
		window.win.close();
	}, []);
	const voice = useRealtimeVoice({ chatSessionId, onClosed: closeWindow, closeOnError: false });
	const isEnding = voice.status === 'ending';
	const state = personaState(voice.status, voice.isMuted);
	const statusMessage =
		voice.errorMessage ??
		(voice.status === 'checking-permission' ? null : statusLabels[voice.status]);

	useEffect(() => {
		void voice.start();
	}, [voice.start]);

	return (
		<main
			className="app-translucent-window flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
			data-voice-window
		>
			<div
				className="relative flex h-12 shrink-0 items-center justify-center select-none"
				style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
			>
				<span className="text-sm font-normal tracking-wide text-muted-foreground">
					Voice conversation
				</span>
			</div>
			<div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
				<div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-[1.35rem] bg-neutral-950">
					<Persona
						state={state}
						level={state === 'speaking' ? 0.72 : state === 'listening' ? 0.28 : 0.16}
						size={208}
					/>
				</div>
			</div>
			<div className="flex shrink-0 flex-col gap-2 px-5 pb-4 pt-3">
				<div
					className={cn(
						'flex items-center gap-3',
						statusMessage ? 'justify-between' : 'justify-end'
					)}
				>
					{statusMessage ? (
						<span
							role="status"
							aria-live="polite"
							className={cn(
								'truncate text-xs font-medium text-muted-foreground',
								voice.status === 'error' && 'text-destructive'
							)}
						>
							{statusMessage}
						</span>
					) : null}
					<span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
						{formatDuration(voice.elapsedMs)}
					</span>
				</div>
				<div className="flex items-center justify-center gap-2">
					<button
						type="button"
						aria-label="End voice conversation"
						disabled={isEnding}
						onClick={() => void voice.end()}
						className="flex h-10 min-w-28 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-50"
					>
						{isEnding ? <TypingLoader size="sm" /> : null}
						<span>{voice.status === 'error' ? 'Close' : 'End'}</span>
					</button>
				</div>
			</div>
		</main>
	);
}
