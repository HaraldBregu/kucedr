import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import type { AgentPromptInputCapabilities } from '@shared/agent_types';
import { AnimatePresence, motion, resize } from 'motion/react';
import {
	AlertCircle,
	ArrowUp,
	AudioLines,
	FileAudio,
	Mic,
	Paperclip,
	Plus,
	Square,
	X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Split } from '@/components/app/base/page';
import appIcon from '@resources/icons/icon.png';
import { AudioPlayer } from '@/components/audio-player';
import { Button } from '@/components/ui/button';
import {
	ChatContainerContent,
	ChatContainerRoot,
	ChatContainerScrollAnchor,
} from '@/components/ui/chat-container';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { PromptEditor } from '@/components/prompt-editor';
import {
	PromptInputAction,
	PromptInputActions,
	usePromptInput,
	type PromptInputVoiceMode,
} from '@/components/ui/prompt-input';
import { PromptSuggestion } from '@/components/ui/prompt-suggestion';
import { ScrollButton } from '@/components/ui/scroll-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatMode, type ChatMode } from '@/contexts/chat-mode';
import { useChatSession } from '@/contexts/chat-session';
import { cn } from '@/lib/utils';
import type { StickToBottomContext } from '@/hooks/use-stick-to-bottom';
import { AssistantMessage } from './components/AssistantMessage';
import { ReplyPreview } from './components/Reply';
import { UserMessage } from './components/UserMessage';
import { Provider, welcomeMessage } from './context';
import {
	useAudioRecorder,
	useHomeAgent,
	useRealtimeDictation,
	useVoiceButtonMode,
	type VoiceButtonMode,
} from './hooks';
import { appendTranscriptionText, fileToSttAudioInput } from './hooks/stt';
import { ensureAppMicrophoneAccess } from './hooks/audio';
import type { PromptAttachment } from './attachments/types';
import { validatePromptAttachments } from './attachments/validation';
import { HomeSidebar } from './Sidebar';

const promptSuggestions = [
	{
		label: 'Schedule a task',
		prompt: 'Every morning at 9, summarize my day and send me the highlights.',
	},
	{
		label: 'Create a sound',
		prompt: 'Create a 10 second sound of rain falling on a window.',
	},
	{
		label: 'Create an image',
		prompt: 'Create an image of a cozy workspace at sunset.',
	},
	{
		label: 'Create a video',
		prompt: 'Create a short video of waves rolling onto a beach at dawn.',
	},
	{
		label: 'Create music',
		prompt: 'Create a relaxing ambient music track for focused work.',
	},
	{
		label: 'Contact an agent',
		prompt: 'Contact an agent to help me research and plan my next project.',
	},
	{
		label: 'Summarize a document',
		prompt: 'Summarize the key points from a document I upload.',
	},
	{
		label: 'Plan a trip',
		prompt: 'Plan a five-day trip to Rome with food, art, and quiet neighborhoods.',
	},
] as const;

function attachmentId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return hours > 0
		? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
		: `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatFileSize(size: number): string {
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
	return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function filesToAttachments(files: File[]): PromptAttachment[] {
	return files.map((file) => ({
		id: attachmentId(),
		kind: 'file',
		file,
	}));
}

function RecorderErrorMessage({
	message,
	actionLabel,
	onAction,
}: {
	readonly message: string | null;
	readonly actionLabel?: string;
	readonly onAction?: () => void;
}): ReactElement | null {
	if (!message) return null;

	return (
		<div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive shadow-sm">
			<AlertCircle className="size-4 shrink-0" />
			<p className="min-w-0 flex-1 truncate text-xs font-medium">{message}</p>
			{actionLabel && onAction ? (
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="shrink-0 border-destructive/30 bg-background/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={onAction}
				>
					{actionLabel}
				</Button>
			) : null}
		</div>
	);
}

function EmptyConversation(): ReactElement {
	return (
		<Empty className="mx-auto max-w-xl border-0 p-0">
			<EmptyHeader className="max-w-lg gap-4">
				<EmptyMedia className="mb-2">
					<img
						src={appIcon}
						alt="Kucedr logo"
						className="size-[72px] rounded-2xl object-contain dark:invert"
					/>
				</EmptyMedia>
				<EmptyTitle className="text-2xl font-bold leading-tight text-foreground">
					What can I do for you?
				</EmptyTitle>
				<EmptyDescription className="max-w-md text-base/relaxed font-medium">
					I schedule tasks, watch your system, and create images, video and music. Pick an example
					below or type your own.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function PromptSuggestions({
	onUseSuggestion,
}: {
	readonly onUseSuggestion: (prompt: string) => void;
}): ReactElement {
	return (
		<div
			className="mx-auto mb-2 mt-3 flex w-full max-w-md flex-wrap justify-center gap-2.5 px-1"
			aria-label="Prompt suggestions"
		>
			{promptSuggestions.map((suggestion) => (
				<PromptSuggestion
					key={suggestion.label}
					type="button"
					variant="outline"
					size="sm"
					className="h-9 max-w-full border-border/70 bg-card/95 px-4 text-xs font-medium text-muted-foreground shadow-sm shadow-foreground/5 hover:bg-muted hover:text-foreground"
					aria-label={suggestion.prompt}
					onClick={() => onUseSuggestion(suggestion.prompt)}
				>
					{suggestion.label}
				</PromptSuggestion>
			))}
		</div>
	);
}

function AttachmentTray({
	attachments,
	onRemove,
}: {
	readonly attachments: readonly PromptAttachment[];
	readonly onRemove: (id: string) => void;
}): ReactElement | null {
	if (attachments.length === 0) return null;

	return (
		<div className="flex w-full flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
			{attachments.map((attachment) => {
				const isAudio = attachment.kind === 'audio';
				const title = isAudio
					? `Audio ${formatDuration(attachment.durationMs ?? 0)}`
					: attachment.file.name;

				return (
					<Tooltip key={attachment.id}>
						<TooltipTrigger
							render={
								<div
									className={cn(
										'flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 py-0.5 pl-1.5 pr-0.5',
										isAudio ? 'max-w-md flex-wrap' : 'max-w-64 flex-wrap',
										attachment.error && 'border-destructive/40 bg-destructive/10 text-destructive'
									)}
								>
									<span className="shrink-0 text-muted-foreground">
										{isAudio ? (
											<FileAudio className="size-2.5" />
										) : (
											<Paperclip className="size-2.5" />
										)}
									</span>
									<span className="min-w-0 truncate text-[9px] leading-tight">{title}</span>
									<span className="shrink-0 text-[8px] leading-tight text-muted-foreground">
										{formatFileSize(attachment.file.size)}
									</span>
									{isAudio && attachment.url ? (
										<AudioPlayer
											src={attachment.url}
											className="order-last basis-full border-0 bg-transparent px-1 py-1"
										/>
									) : null}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-4 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
										aria-label={`Remove ${title}`}
										onClick={() => onRemove(attachment.id)}
									>
										<X className="size-2.5" />
									</Button>
									{attachment.error ? (
										<span className="basis-full truncate px-1 pb-0.5 text-[8px] leading-tight text-destructive">
											{attachment.error}
										</span>
									) : null}
								</div>
							}
						/>
						<TooltipContent side="top">{attachment.error ?? attachment.file.name}</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
}

function AttachmentButton({
	disabled,
	disabledReason,
}: {
	readonly disabled?: boolean;
	readonly disabledReason?: string;
}): ReactElement {
	const { triggerFileUpload } = usePromptInput();
	return (
		<PromptInputAction tooltip={disabledReason ?? 'Add attachment'}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label="Add attachment"
				disabled={disabled}
				onClick={triggerFileUpload}
			>
				<Plus className="size-5" />
			</Button>
		</PromptInputAction>
	);
}

function VoiceButton({
	onVoiceModeRequest,
	disabled,
	disabledReason,
	mode,
}: {
	readonly onVoiceModeRequest: () => void;
	readonly disabled?: boolean;
	readonly disabledReason?: string;
	readonly mode: VoiceButtonMode;
}): ReactElement {
	const label = mode === 'record' ? 'Record voice' : 'Dictate';
	const isDisabled = disabled || mode === 'disabled';
	const tooltip =
		mode === 'disabled'
			? 'Choose a speech-to-text provider and model in Settings.'
			: disabledReason ?? label;

	return (
		<PromptInputAction tooltip={tooltip} showTooltipWhenDisabled={isDisabled}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-8 rounded-full text-foreground hover:bg-muted"
				aria-label={tooltip}
				disabled={isDisabled}
				onClick={onVoiceModeRequest}
			>
				<Mic className="size-4" />
			</Button>
		</PromptInputAction>
	);
}

// function SpeakButton({
// 	text,
// 	disabled,
// 	onError,
// }: {
// 	readonly text: string;
// 	readonly disabled?: boolean;
// 	readonly onError: (message: string | null) => void;
// }): ReactElement {
// 	const [speaking, setSpeaking] = useState(false);

// 	const speak = async (): Promise<void> => {
// 		setSpeaking(true);
// 		onError(null);
// 		try {
// 			const result = await window.speech.synthesize({ text });
// 			await new Audio(`data:${result.mimeType};base64,${result.audio}`).play();
// 		} catch (error) {
// 			onError(
// 				error instanceof Error && error.message.trim()
// 					? error.message
// 					: 'Speech synthesis failed.'
// 			);
// 		} finally {
// 			setSpeaking(false);
// 		}
// 	};

// 	return (
// 		<PromptInputAction tooltip="Speak text">
// 			<Button
// 				type="button"
// 				variant="ghost"
// 				size="icon"
// 				className="size-8 rounded-full text-foreground hover:bg-muted"
// 				aria-label="Speak text"
// 				disabled={disabled || speaking}
// 				onClick={() => void speak()}
// 			>
// 				<Volume2 className="size-4" />
// 			</Button>
// 		</PromptInputAction>
// 	);
// }

function SubmitButton({
	isLoading,
	canSubmit,
	forceSubmit,
	disabled,
	onAction,
}: {
	readonly isLoading: boolean;
	readonly canSubmit: boolean;
	readonly forceSubmit?: boolean;
	readonly disabled?: boolean;
	readonly onAction: () => void;
}): ReactElement {
	const submitVisible = canSubmit || forceSubmit;
	const label = isLoading
		? 'Stop generation'
		: submitVisible
			? 'Send message'
			: 'Start voice conversation';
	const iconKey = isLoading ? 'stop' : submitVisible ? 'send' : 'voice';
	const icon = isLoading ? (
		<Square className="size-4 fill-current" />
	) : submitVisible ? (
		<ArrowUp className="size-4" />
	) : (
		<AudioLines className="size-4" />
	);

	return (
		<PromptInputAction tooltip={label}>
			<Button
				type="button"
				variant="default"
				size="icon"
				className="size-9 overflow-hidden rounded-full bg-foreground text-background hover:bg-foreground/90"
				aria-label={label}
				disabled={disabled}
				onClick={onAction}
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={iconKey}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
						className="flex items-center justify-center"
					>
						{icon}
					</motion.span>
				</AnimatePresence>
			</Button>
		</PromptInputAction>
	);
}

function PageContent(): ReactElement {
	const { mode, setMode } = useChatMode();
	const { sessionId: chatSessionId } = useChatSession();
	const navigate = useNavigate();
	const workspaceRef = useRef<HTMLDivElement>(null);
	const composerRef = useRef<HTMLDivElement>(null);
	const chatScrollRef = useRef<StickToBottomContext>(null);
	useLayoutEffect(() => {
		const workspace = workspaceRef.current;
		const composer = composerRef.current;
		if (!workspace || !composer) return;
		const updateSpacing = (): void => {
			workspace.style.setProperty('--composer-height', `${composer.getBoundingClientRect().height}px`);
			const scrollState = chatScrollRef.current?.state;
			if (scrollState?.isAtBottom) scrollState.scrollTop = scrollState.calculatedTargetScrollTop;
		};
		updateSpacing();
		return resize(composer, updateSpacing);
	}, []);
	const [voiceMode, setVoiceMode] = useState<PromptInputVoiceMode | null>(null);
	const [activeDictationMode, setActiveDictationMode] = useState<VoiceButtonMode | null>(null);
	const updateMode = useCallback(
		(nextMode: ChatMode): void => {
			if (nextMode === 'chat') {
				setActiveDictationMode(null);
				setVoiceMode(null);
			}
			setMode(nextMode);
		},
		[setMode]
	);
	const closeVoiceUi = useCallback((): void => {
		updateMode('chat');
	}, [updateMode]);
	const agent = useHomeAgent({ setMode: updateMode });
	const dictation = useRealtimeDictation({
		value: agent.input,
		onValueChange: agent.setInput,
	});
	const recorder = useAudioRecorder();
	const voiceButtonMode = useVoiceButtonMode();
	const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
	const [promptCapabilities, setPromptCapabilities] =
		useState<AgentPromptInputCapabilities | null>();
	const [planCommandActive, setPlanCommandActive] = useState(false);
	const [goalCommandActive, setGoalCommandActive] = useState(false);
	const [transcriptionErrorMessage, setTranscriptionErrorMessage] = useState<string | null>(null);
	const [transcribingRecording, setTranscribingRecording] = useState(false);
	const transcriptionRunRef = useRef(0);
	const visibleMessages = agent.chatState.messages.filter(
		(message) => message.id !== welcomeMessage.id
	);
	const showEmptyConversation =
		visibleMessages.length === 0 && !agent.isLoading && !agent.historyLoading;
	const showPromptSuggestions = showEmptyConversation && voiceMode === null;
	const hasPromptText = agent.input.trim().length > 0;
	const hasGoalObjective = agent.input.replace(/^\/goal\s*/i, '').trim().length > 0;
	const hasAttachmentErrors = attachments.some((attachment) => Boolean(attachment.error));
	const canSubmit =
		planCommandActive || goalCommandActive
			? goalCommandActive
				? hasGoalObjective
				: hasPromptText
			: hasPromptText || attachments.length > 0;
	const dictationStatus = dictation.status;
	const cancelDictationSession = dictation.cancel;
	const recorderStatus = recorder.status;
	const cancelRecordingSession = recorder.cancel;
	const dictationBusy =
		dictationStatus === 'checking-permission' ||
		dictationStatus === 'connecting' ||
		dictationStatus === 'finishing';
	const recordingBusy =
		recorderStatus === 'checking-permission' ||
		recorderStatus === 'stopping' ||
		transcribingRecording;
	const voiceBusy = dictationBusy || recordingBusy;
	const attachmentUnavailable = promptCapabilities === undefined || promptCapabilities === null;
	const attachmentDisabled = voiceMode !== null || voiceBusy || attachmentUnavailable;
	const activeVoiceElapsedMs =
		activeDictationMode === 'record' ? recorder.elapsedMs : dictation.elapsedMs;
	const activeVoiceMuted = activeDictationMode === 'record' ? recorder.isMuted : dictation.isMuted;
	const activeVoiceStream = activeDictationMode === 'record' ? recorder.stream : dictation.stream;
	const activeVoiceSetMuted =
		activeDictationMode === 'record' ? recorder.setMuted : dictation.setMuted;
	const voiceErrorMessage =
		transcriptionErrorMessage ?? recorder.errorMessage ?? dictation.errorMessage;
	const voiceErrorAction = voiceErrorMessage?.toLowerCase().includes('microphone')
		? {
				label: 'Open Microphone settings',
				action: () => navigate('/settings/system/media/microphone'),
			}
		: undefined;
	const voiceButtonDisabledReason =
		voiceButtonMode === 'disabled'
			? 'Choose a speech-to-text provider and model in Settings.'
			: voiceBusy
				? 'Wait for the current voice operation to finish.'
				: agent.isLoading
					? 'Wait for the current response to finish.'
					: undefined;

	useEffect(() => {
		if (mode !== 'chat') return;
		if (
			dictationStatus === 'checking-permission' ||
			dictationStatus === 'connecting' ||
			dictationStatus === 'recording'
		) {
			void cancelDictationSession();
		}
		if (
			recorderStatus === 'checking-permission' ||
			recorderStatus === 'recording' ||
			recorderStatus === 'stopping'
		) {
			void cancelRecordingSession();
		}
	}, [
		cancelDictationSession,
		cancelRecordingSession,
		dictationStatus,
		mode,
		recorderStatus,
	]);

	useEffect(() => () => setMode('chat'), [setMode]);

	useEffect(() => {
		let active = true;
		const refresh = (): void => {
			void window.agent
				.getPromptInputCapabilities()
				.then((capabilities) => {
					if (!active) return;
					setPromptCapabilities(capabilities);
					setAttachments((current) => validatePromptAttachments(current, capabilities));
				})
				.catch(() => {
					if (!active) return;
					setPromptCapabilities(null);
					setAttachments((current) => validatePromptAttachments(current, null));
				});
		};
		refresh();
		const unsubscribe = window.app.onModelsChanged(refresh);
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);

	const removeAttachment = useCallback((id: string): void => {
		setAttachments((current) =>
			current.filter((attachment) => {
				if (attachment.id !== id) return true;
				if (attachment.url) {
					URL.revokeObjectURL(attachment.url);
				}
				return false;
			})
		);
	}, []);

	const clearAttachments = useCallback((): void => {
		setAttachments((current) => {
			for (const attachment of current) {
				if (attachment.url) URL.revokeObjectURL(attachment.url);
			}
			return [];
		});
	}, []);

	const submitPrompt = async (): Promise<void> => {
		if (agent.isLoading) {
			await agent.handleSubmit();
			return;
		}
		if (
			(planCommandActive && !hasPromptText) ||
			(goalCommandActive && !hasGoalObjective) ||
			hasAttachmentErrors
		)
			return;
		const submittedFiles = attachments.map((attachment) => attachment.file);
		clearAttachments();
		if (goalCommandActive) setGoalCommandActive(false);
		await agent.handleSubmit(submittedFiles, planCommandActive ? 'plan' : undefined);
	};

	const returnToChat = (): void => {
		closeVoiceUi();
	};

	const startVoiceConversation = async (): Promise<void> => {
		setTranscriptionErrorMessage(null);
		try {
			await ensureAppMicrophoneAccess();
			await window.win.openVoiceConversation(chatSessionId);
		} catch (error) {
			setTranscriptionErrorMessage(
				error instanceof Error && error.message.trim()
					? error.message
					: 'Voice conversation could not be opened.'
			);
		}
	};

	const startDictation = async (): Promise<void> => {
		setTranscriptionErrorMessage(null);
		if (voiceButtonMode === 'disabled') {
			setTranscriptionErrorMessage('Choose a speech-to-text provider and model in Settings.');
			return;
		}
		if (voiceButtonMode === 'record') {
			const started = await recorder.start();
			if (!started) {
				updateMode('chat');
				return;
			}
			setActiveDictationMode('record');
			setVoiceMode('dictation');
			updateMode('voice');
			return;
		}

		const started = await dictation.start();
		if (!started) {
			updateMode('chat');
			return;
		}
		setActiveDictationMode('dictate');
		setVoiceMode('dictation');
		updateMode('voice');
	};

	const cancelDictation = async (): Promise<void> => {
		transcriptionRunRef.current += 1;
		setTranscribingRecording(false);
		if (activeDictationMode === 'record') {
			await recorder.cancel();
		} else {
			await dictation.cancel();
		}
		returnToChat();
	};

	const confirmDictation = async (): Promise<void> => {
		if (activeDictationMode === 'record') {
			const runId = transcriptionRunRef.current + 1;
			transcriptionRunRef.current = runId;
			setTranscribingRecording(true);
			setTranscriptionErrorMessage(null);

			try {
				const recording = await recorder.stop();
				if (!recording) {
					returnToChat();
					return;
				}

				try {
					const result = await window.models.transcribe.transcribe({
						audio: await fileToSttAudioInput(recording.file),
					});
					if (transcriptionRunRef.current === runId) {
						agent.setInput(appendTranscriptionText(agent.input, result.text));
					}
				} finally {
					if (recording.url) URL.revokeObjectURL(recording.url);
				}
			} catch (error) {
				const message =
					error instanceof Error && error.message.trim()
						? error.message
						: 'Speech transcription failed.';
				if (transcriptionRunRef.current === runId) setTranscriptionErrorMessage(message);
			} finally {
				if (transcriptionRunRef.current === runId) {
					setTranscribingRecording(false);
					returnToChat();
				}
			}
			return;
		}

		await dictation.finish();
		returnToChat();
	};

	const handlePrimaryAction = (): void => {
		if (agent.isLoading || canSubmit) {
			void submitPrompt();
			return;
		}
		void startVoiceConversation();
	};

	// PromptInput retains its conversation-mode rendering for future reuse; launch now opens the dedicated voice window.
	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split
				sidebar={
					<HomeSidebar
						refreshKey={`${chatSessionId}:${visibleMessages.length}:${agent.isLoading}`}
					/>
				}
			>
				<div
					ref={workspaceRef}
					data-slot="home-workspace"
					className="relative flex min-h-0 flex-1 flex-col bg-background text-foreground"
				>
					<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
						{agent.isLoading ? 'Kucedr is responding' : 'Kucedr is ready'}
					</span>
					<ChatContainerRoot
						className="min-h-0 p-0 [scrollbar-gutter:auto]"
						contextRef={chatScrollRef}
					>
						<ChatContainerContent
							className={cn(
								'mx-auto w-full max-w-4xl gap-5 px-4',
								showEmptyConversation
									? 'h-full min-h-0 justify-center overflow-hidden pb-36 pt-20'
									: 'min-h-full pt-6'
							)}
						>
							{showEmptyConversation ? (
								<>
									<EmptyConversation />
									{showPromptSuggestions ? (
										<PromptSuggestions onUseSuggestion={agent.useSuggestion} />
									) : null}
								</>
							) : (
								<>
									{visibleMessages.map((message, index) => {
										const previous = index > 0 ? visibleMessages[index - 1] : null;
										const isPreviousMessage = index < visibleMessages.length - 1;
										const showAssistantHeader = !previous || previous.role !== 'agent';
										const groupedAssistantClassName = showAssistantHeader ? undefined : '-mt-5';

										if (message.role === 'user') {
											const userOffsetFromEnd = visibleMessages
												.slice(index + 1)
												.filter((nextMessage) => nextMessage.role === 'user').length;
											return (
												<UserMessage
													key={message.id}
													content={message.content}
													collapseLongContent={isPreviousMessage}
													canEdit={!agent.isLoading && voiceMode === null}
													onEdit={(content) =>
														agent.editUserMessage(message.id, userOffsetFromEnd, content)
													}
												/>
											);
										}

										return (
											<AssistantMessage
												key={message.id}
												message={message}
												isStreaming={
													agent.isLoading && message.id === agent.chatState.activeAgentId
												}
												showHeader={showAssistantHeader}
												collapseLongContent={isPreviousMessage}
												className={groupedAssistantClassName}
												onReply={agent.replyToMessage}
												canImplement={
													index === visibleMessages.length - 1 &&
													message.state === 'completed' &&
													!agent.isLoading
												}
												onImplement={agent.implementPlan}
											/>
										);
									})}
								</>
							)}
							<ChatContainerScrollAnchor
								className={showEmptyConversation ? 'h-0' : 'h-[var(--composer-height,7rem)]'}
							/>
						</ChatContainerContent>
		<div
			className="pointer-events-none absolute inset-x-0 bottom-[var(--composer-height,6rem)] z-30 flex justify-center"
		>
							<ScrollButton
								type="button"
								aria-label="Scroll to latest"
								className="pointer-events-auto"
							/>
						</div>
					</ChatContainerRoot>
					<div
						ref={composerRef}
						data-slot="home-composer-shell"
						className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-5 pt-3"
					>
						<div className="mx-auto w-full max-w-4xl">
							<RecorderErrorMessage
								message={voiceErrorMessage}
								actionLabel={voiceErrorAction?.label}
								onAction={voiceErrorAction?.action}
							/>
							<PromptEditor
								placeholder="Ask anything"
								ariaLabel="Message Kucedr"
								value={agent.input}
								onValueChange={agent.setInput}
								onPlanCommandChange={(active) => {
									setPlanCommandActive(active);
									agent.setInteractionMode(active ? 'plan' : 'default');
								}}
								onGoalCommandChange={setGoalCommandActive}
								isLoading={agent.isLoading}
								maxHeight={360}
								onSubmit={() => void submitPrompt()}
								textareaRef={agent.inputRef}
								header={
									agent.replyTo || attachments.length > 0 ? (
										<div className="flex min-w-0 flex-col gap-2">
											{agent.replyTo ? (
												<ReplyPreview content={agent.replyTo.content} onCancel={agent.clearReply} />
											) : null}
											{attachments.length > 0 ? (
												<AttachmentTray attachments={attachments} onRemove={removeAttachment} />
											) : null}
										</div>
									) : undefined
								}
								leadingAction={
									voiceMode === 'dictation' ? undefined : (
										<AttachmentButton
											disabled={attachmentDisabled}
											disabledReason={
												attachmentUnavailable ? 'Attachment support is unavailable' : undefined
											}
										/>
									)
								}
								voiceMode={voiceMode === 'dictation' ? voiceMode : null}
								voiceElapsedMs={activeVoiceElapsedMs}
								voiceMuted={activeVoiceMuted}
								voiceMediaStream={activeVoiceStream}
								voiceAnalyser={null}
								onVoiceMutedChange={activeVoiceSetMuted}
								onVoiceCancel={() => void cancelDictation()}
								onVoiceConfirm={() => void confirmDictation()}
								filesAccept={promptCapabilities?.accept}
								onFilesChange={(files) => {
									if (!promptCapabilities) return;
									setAttachments((current) =>
										validatePromptAttachments(
											[...current, ...filesToAttachments(files)],
											promptCapabilities
										)
									);
								}}
								wrapperClassName="max-w-none"
								className={cn(
									'w-full',
									planCommandActive && 'plan-prompt-frame',
									goalCommandActive && 'goal-prompt-frame'
								)}
								actions={
									<PromptInputActions className="justify-end gap-1.5">
										<VoiceButton
											onVoiceModeRequest={() => void startDictation()}
											disabled={voiceBusy || agent.isLoading}
											disabledReason={voiceButtonDisabledReason}
											mode={voiceButtonMode}
										/>
										<SubmitButton
											isLoading={agent.isLoading}
											canSubmit={canSubmit}
											forceSubmit={planCommandActive || goalCommandActive}
											disabled={
												voiceBusy ||
												hasAttachmentErrors ||
												(planCommandActive && !hasPromptText) ||
												(goalCommandActive && !hasGoalObjective)
											}
											onAction={handlePrimaryAction}
										/>
									</PromptInputActions>
								}
							/>
						</div>
					</div>
				</div>
			</Split>
		</PageContainer>
	);
}

function Page(): ReactElement {
	return (
		<Provider>
			<PageContent />
		</Provider>
	);
}

export default Page;
