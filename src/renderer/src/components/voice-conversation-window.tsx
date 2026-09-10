import { useCallback, useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
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

	useEffect(() => {
		void voice.start();
	}, [voice.start]);

	return (
		<main className="h-full p-3 text-foreground" data-voice-window>
			<div className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
				<div className="flex h-11 shrink-0 items-center justify-between px-4">
					<span className="text-xs font-semibold tracking-wide text-muted-foreground">
						Voice conversation
					</span>
					<button
						type="button"
						aria-label="End voice conversation"
						disabled={isEnding}
						onClick={() => void voice.end()}
						className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-50"
					>
						<X className="size-4" strokeWidth={2.4} />
					</button>
				</div>
				<div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
					<div className="relative flex size-full max-h-[min(62vh,22rem)] min-h-56 items-center justify-center overflow-hidden rounded-[1.35rem] bg-neutral-950">
						<Persona
							state={state}
							level={state === 'speaking' ? 0.72 : state === 'listening' ? 0.28 : 0.16}
							size={176}
						/>
					</div>
				</div>
				<div className="flex shrink-0 flex-col gap-3 px-5 pb-5 pt-4">
					<div className="flex items-center justify-between gap-3">
						<span
							role="status"
							aria-live="polite"
							className={cn(
								'truncate text-xs font-medium text-muted-foreground',
								voice.status === 'error' && 'text-destructive'
							)}
						>
							{voice.errorMessage ?? statusLabels[voice.status]}
						</span>
						<span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
							{formatDuration(voice.elapsedMs)}
						</span>
					</div>
					<div className="flex items-center justify-center gap-2">
						<button
							type="button"
							aria-label={voice.isMuted ? 'Unmute' : 'Mute'}
							disabled={!voice.isActive || isEnding}
							onClick={() => voice.setMuted(!voice.isMuted)}
							className={cn(
								'flex size-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
								voice.isMuted
									? 'border-destructive/40 bg-destructive/10 text-destructive focus-visible:ring-destructive/40'
									: 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/55'
							)}
						>
							{voice.isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
						</button>
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
			</div>
		</main>
	);
}
