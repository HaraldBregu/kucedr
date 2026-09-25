import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	memo,
	type ReactElement,
} from 'react';
import { AnimatePresence, motion, resize } from 'motion/react';
import {
	AlertCircle,
	ArrowUp,
	FileAudioIcon,
	FileCodeIcon,
	FileImageIcon,
	FileTextIcon,
	Mic,
	Plus,
	Square,
	TableIcon,
	X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clearLogo from '@resources/icons/icon-clear.svg';
import { PageContainer, Split } from '@/components/app/base/page';
import { AudioPlayer } from '@/components/audio-player';
import { Button } from '@/components/ui/button';
import {
	Attachment,
	AttachmentAction,
	AttachmentActions,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from '@/components/ui/attachment';
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
import { useChatMode, type ChatMode } from '@/contexts/chat-mode';
import { useChatSession } from '@/contexts/chat-session';
import { cn } from '@/lib/utils';
import type { StickToBottomContext } from '@/hooks/use-stick-to-bottom';
import { ReplyPreview } from './components/Reply';
import { Messages } from './Messages';
import { Provider, welcomeMessage } from './context';
import {
	useAudioRecorder,
	useHomeAgent,
	useRealtimeDictation,
	useVoiceButtonMode,
	type VoiceButtonMode,
} from './hooks';
import { appendTranscriptionText, fileToSttAudioInput } from './hooks/stt';
import type { PromptAttachment } from './attachments/types';
import { Preview } from './attachments/Preview';
import { formatFileSize } from './attachments/size';
import { attachmentPath } from './attachments/path';
import { readDraftAttachments } from './attachments/read';
import { saveDraftAttachments } from './attachments/save';
import { HomeSidebar } from './Sidebar';
import { Model } from './Model';

const StableHomeSidebar = memo(HomeSidebar);

const promptSuggestions = [
	[
		{
			label: 'Plan my day',
			prompt: 'Every morning at 9, summarize my day and send me the highlights.',
		},
		{
			label: 'Rain sound',
			prompt: 'Create the sound of rain on a window.',
		},
		{
			label: 'Create an image',
			prompt:
				'Create a watercolor image of a cozy workspace at sunset, with warm light and a cat sleeping on the desk.',
		},
	],
	[
		{
			label: 'Video',
			prompt: 'Create a five-second video of ocean waves.',
		},
		{
			label: 'Brainstorm project ideas',
			prompt:
				'Give me ten practical ideas for a weekend project I could finish with basic tools and a small budget.',
		},
	],
	[
		{
			label: 'Draft a thank-you',
			prompt: 'Write a friendly reply thanking a colleague for their help.',
		},
	],
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

function filesToAttachments(files: File[]): PromptAttachment[] {
	return files.map((file) => ({
		id: attachmentId(),
		kind: 'file',
		file,
		path: attachmentPath(file) || undefined,
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
		<Empty className="mx-auto max-w-xl flex-none border-0 p-0">
			<EmptyHeader className="max-w-lg gap-4">
				<EmptyMedia className="mb-2">
					<img
						src={clearLogo}
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
			className="mx-auto flex w-full max-w-sm flex-col items-center gap-2"
			aria-label="Prompt suggestions"
		>
			{promptSuggestions.map((row) => (
				<div key={row[0].label} className="flex w-full items-center justify-center gap-2">
					{row.map((suggestion) => (
						<PromptSuggestion
							key={suggestion.label}
							type="button"
							variant="outline"
							size="sm"
							className="h-auto min-h-9 min-w-0 max-w-full whitespace-normal border-border/70 bg-card/95 px-2 py-1 text-center text-xs font-medium text-muted-foreground shadow-sm shadow-foreground/5 hover:bg-muted hover:text-foreground"
							aria-label={suggestion.prompt}
							onClick={() => onUseSuggestion(suggestion.prompt)}
						>
							{suggestion.label}
						</PromptSuggestion>
					))}
				</div>
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
		<AttachmentGroup className="w-full" onClick={(event) => event.stopPropagation()}>
			{attachments.map((attachment) => {
				const isAudio = attachment.kind === 'audio';
				const title = isAudio
					? `Audio ${formatDuration(attachment.durationMs ?? 0)}`
					: attachment.file.name;
				const extension = attachment.file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
				const isImage = attachment.file.type.startsWith('image/');
				const Icon =
					isAudio || attachment.file.type.startsWith('audio/')
						? FileAudioIcon
						: isImage
							? FileImageIcon
							: /\.(csv|xlsx?|ods)$/i.test(attachment.file.name)
								? TableIcon
								: /\.(jsx?|tsx?|json|html|css|py|sh)$/i.test(attachment.file.name)
									? FileCodeIcon
									: FileTextIcon;

				return (
					<Attachment
						key={attachment.id}
						size="sm"
						className={cn(
							'rounded-[16px] has-data-[slot=attachment-content]:px-3 has-data-[slot=attachment-content]:py-2.5 has-data-[slot=attachment-media]:p-2.5',
							isAudio ? 'w-80' : 'w-64'
						)}
					>
						<AttachmentMedia variant={isImage ? 'image' : 'icon'}>
							{isImage ? <Preview file={attachment.file} /> : <Icon />}
						</AttachmentMedia>
						<AttachmentContent>
							<AttachmentTitle title={title}>{title}</AttachmentTitle>
							<AttachmentDescription>
								{extension} · {formatFileSize(attachment.file.size)}
							</AttachmentDescription>
						</AttachmentContent>
						<AttachmentActions>
							<AttachmentAction
								type="button"
								aria-label={`Remove ${title}`}
								onClick={() => onRemove(attachment.id)}
							>
								<X className="size-3.5" />
							</AttachmentAction>
						</AttachmentActions>
						{isAudio && attachment.url ? (
							<AudioPlayer
								src={attachment.url}
								className="basis-full border-0 bg-transparent px-1 py-1"
							/>
						) : null}
					</Attachment>
				);
			})}
		</AttachmentGroup>
	);
}

function AttachmentButton({ disabled }: { readonly disabled?: boolean }): ReactElement {
	const { triggerFileUpload } = usePromptInput();
	return (
		<PromptInputAction tooltip="Add attachment">
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="text-muted-foreground hover:text-foreground"
				aria-label="Add attachment"
				disabled={disabled}
				onClick={triggerFileUpload}
			>
				<Plus className="size-3.5" />
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
			: (disabledReason ?? label);

	return (
		<PromptInputAction tooltip={tooltip} showTooltipWhenDisabled={isDisabled}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-10 rounded-full text-foreground hover:bg-muted"
				aria-label={tooltip}
				disabled={isDisabled}
				onClick={onVoiceModeRequest}
			>
				<Mic className="size-5" />
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
	onAction,
}: {
	readonly isLoading: boolean;
	readonly onAction: () => void;
}): ReactElement {
	const label = isLoading ? 'Stop generation' : 'Send message';
	const iconKey = isLoading ? 'stop' : 'send';
	const icon = isLoading ? (
		<Square className="size-5 fill-current" />
	) : (
		<ArrowUp className="size-5" />
	);

	return (
		<PromptInputAction tooltip={label}>
			<Button
				type="button"
				variant="default"
				size="icon"
				className="size-10 overflow-hidden rounded-full bg-foreground text-background hover:bg-foreground/90"
				aria-label={label}
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
			workspace.style.setProperty(
				'--composer-height',
				`${composer.getBoundingClientRect().height}px`
			);
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
	const [attachmentsSessionId, setAttachmentsSessionId] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		setAttachments([]);
		setAttachmentsSessionId(null);
		void Promise.all(
			readDraftAttachments(chatSessionId).map(async (entry): Promise<PromptAttachment | null> => {
				try {
					const bytes = await window.agent.readPromptFile(entry.path);
					const file = new File([new Uint8Array(bytes)], entry.name, { type: entry.mimeType });
					attachmentPath(file, entry.path);
					return { id: attachmentId(), kind: 'file', file, path: entry.path };
				} catch {
					return null;
				}
			})
		).then((restored) => {
			if (!active) return;
			setAttachments((current) => [
				...restored.filter((item): item is PromptAttachment => item !== null),
				...current,
			]);
			setAttachmentsSessionId(chatSessionId);
		});
		return () => {
			active = false;
		};
	}, [chatSessionId]);
	useEffect(() => {
		if (attachmentsSessionId === chatSessionId) saveDraftAttachments(chatSessionId, attachments);
	}, [attachments, attachmentsSessionId, chatSessionId]);
	const [planCommandActive, setPlanCommandActive] = useState(false);
	const [goalCommandActive, setGoalCommandActive] = useState(false);
	const [transcriptionErrorMessage, setTranscriptionErrorMessage] = useState<string | null>(null);
	const [transcribingRecording, setTranscribingRecording] = useState(false);
	const transcriptionRunRef = useRef(0);
	const visibleMessages = useMemo(
		() => agent.chatState.messages.filter((message) => message.id !== welcomeMessage.id),
		[agent.chatState.messages]
	);
	const showEmptyConversation =
		visibleMessages.length === 0 && !agent.isLoading && !agent.historyLoading;
	const showPromptSuggestions = showEmptyConversation && voiceMode === null;
	const hasPromptText = agent.input.trim().length > 0;
	const hasGoalObjective = agent.input.replace(/^\/goal\s*/i, '').trim().length > 0;
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
	const attachmentDisabled = voiceMode !== null || voiceBusy;
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
				action: () => navigate('/settings/general/media/microphone'),
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
	}, [cancelDictationSession, cancelRecordingSession, dictationStatus, mode, recorderStatus]);

	useEffect(() => () => setMode('chat'), [setMode]);

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
		if ((planCommandActive && !hasPromptText) || (goalCommandActive && !hasGoalObjective)) return;
		const submittedFiles = attachments.map((attachment) => attachment.file);
		saveDraftAttachments(chatSessionId, []);
		clearAttachments();
		if (goalCommandActive) setGoalCommandActive(false);
		await agent.handleSubmit(submittedFiles, planCommandActive ? 'plan' : undefined);
	};

	const returnToChat = (): void => {
		closeVoiceUi();
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

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split
				sidebar={
					<StableHomeSidebar
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
									? 'min-h-full items-center justify-center pb-[var(--composer-height,7rem)]'
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
								<Messages
									messages={visibleMessages}
									isLoading={agent.isLoading}
									voiceMode={voiceMode !== null}
									activeAgentId={agent.chatState.activeAgentId}
									onEdit={agent.editUserMessage}
									onReply={agent.replyToMessage}
									onImplement={agent.implementPlan}
								/>
							)}
							<ChatContainerScrollAnchor
								className={showEmptyConversation ? 'h-0' : 'h-[var(--composer-height,7rem)]'}
							/>
						</ChatContainerContent>
						<div className="pointer-events-none absolute inset-x-0 bottom-[var(--composer-height,6rem)] z-30 flex justify-center">
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
							{attachments.length > 0 ? (
								<div className="mb-2">
									<AttachmentTray attachments={attachments} onRemove={removeAttachment} />
								</div>
							) : null}
							<PromptEditor
								placeholder={showEmptyConversation ? 'Ask anything' : 'Send follow-up'}
								ariaLabel="Message Kucedr"
								value={agent.input}
								expanded={agent.input.length > 0}
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
									agent.replyTo ? (
										<ReplyPreview content={agent.replyTo.content} onCancel={agent.clearReply} />
									) : undefined
								}
								leadingAction={
									voiceMode === 'dictation' ? undefined : (
										<AttachmentButton disabled={attachmentDisabled} />
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
								onFilesChange={(files) => {
									setAttachments((current) => [...current, ...filesToAttachments(files)]);
								}}
								wrapperClassName="max-w-none"
								detachedControls
								footerContent={
									<div className="flex min-w-0 items-center text-[11px] text-muted-foreground">
										<Model />
									</div>
								}
								className="w-full"
								inputClassName={cn(
									planCommandActive && 'plan-prompt-frame',
									goalCommandActive && 'goal-prompt-frame'
								)}
								trailingAction={
									<PromptInputActions className="justify-end gap-1.5">
										<VoiceButton
											onVoiceModeRequest={() => void startDictation()}
											disabled={voiceBusy || agent.isLoading}
											disabledReason={voiceButtonDisabledReason}
											mode={voiceButtonMode}
										/>
										<SubmitButton
											isLoading={agent.isLoading}
											onAction={() => void submitPrompt()}
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
