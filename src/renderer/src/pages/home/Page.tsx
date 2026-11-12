import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
} from 'react';
import { resize } from 'motion/react';
import {
	AlertCircle,
	FileAudioIcon,
	FileCodeIcon,
	FileImageIcon,
	FileTextIcon,
	Library,
	Mic,
	MonitorUp,
	Ellipsis,
	Plus,
	TableIcon,
	X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LibraryFile } from '../../../../shared/library_types';
import type { AgentPromptInputCapabilities } from '../../../../shared/agent_types';
import { attachmentLimitError } from '../../../../shared/attachment_limit';
import { workspaceFileType } from '../../../../shared/workspace';
import { PageContainer, Split } from '@/components/app/base/page';
import { AudioPlayer } from '@/components/audio-player';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { LogoView } from '@/components/app/base/logo-view';
import { PromptEditor } from '@/components/prompt-editor';
import { PromptSubmit } from '@/components/prompt-submit';
import {
	PromptInputAction,
	PromptInputActions,
	usePromptInput,
	type PromptInputVoiceMode,
} from '@/components/ui/prompt-input';
import { ScrollButton } from '@/components/ui/scroll-button';
import { useChatMode, type ChatMode } from '@/contexts/chat-mode';
import { useChatSession } from '@/contexts/chat-session';
import { cn } from '@/lib/utils';
import type { StickToBottomContext } from '@/hooks/use-stick-to-bottom';
import { ReplyPreview } from './components/Reply';
import { LibraryPicker } from './components/LibraryPicker';
import { Messages } from './Messages';
import { ChatOutline } from './Outline';
import { ChatDetails } from './Details';
import { LIBRARY_DRAG_TYPE } from '../settings/pages/library/drag';
import { droppedLibraryFiles } from './attachments/library';
import { accepts } from './attachments/accepts';
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
import { ExtensionPage, type OpenExtension } from './components/ExtensionPage';
import { Model } from './Model';
import { Usage } from './Usage';

const StableHomeSidebar = memo(HomeSidebar);
const StableModel = memo(Model);

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
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	return (
		<Empty className="mx-auto max-w-xl flex-none border-0 p-0">
			<EmptyHeader className="max-w-lg flex-row gap-2">
				<LogoView className="size-10 !bg-current dark:!bg-current" />
				<EmptyTitle className="text-3xl font-bold leading-tight text-foreground">
					{greeting}, how are you?
				</EmptyTitle>
			</EmptyHeader>
		</Empty>
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
							{isImage ? (
								<Preview
									file={attachment.file}
									path={attachment.path}
									name={attachment.file.name}
									mimeType={attachment.file.type}
								/>
							) : (
								<Icon />
							)}
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

function AttachmentButton({
	disabled,
	disabledReason,
	onLibrarySelect,
	className,
}: {
	readonly disabled?: boolean;
	readonly disabledReason?: string;
	readonly onLibrarySelect: () => void;
	readonly className?: string;
}): ReactElement {
	const { triggerFileUpload } = usePromptInput();
	return (
		<DropdownMenu>
			<PromptInputAction tooltip={disabledReason ?? 'Add attachment'} showTooltipWhenDisabled={disabled}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn('size-9 rounded-full text-foreground hover:bg-muted', className)}
						aria-label="Add attachment"
						disabled={disabled}
					>
						<Plus className="size-4" />
					</Button>
				</DropdownMenuTrigger>
			</PromptInputAction>
			<DropdownMenuContent align="start" side="top" className="w-52">
				<DropdownMenuItem onSelect={onLibrarySelect}>
					<Library className="size-4" />
					From Library
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={triggerFileUpload}>
					<MonitorUp className="size-4" />
					From computer
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function VoiceButton({
	onVoiceModeRequest,
	disabled,
	disabledReason,
	mode,
	className,
}: {
	readonly onVoiceModeRequest: () => void;
	readonly disabled?: boolean;
	readonly disabledReason?: string;
	readonly mode: VoiceButtonMode;
	readonly className?: string;
}): ReactElement {
	const isDisabled = disabled || mode === 'disabled';
	const tooltip =
		mode === 'disabled'
			? 'Choose a speech-to-text provider and model in Settings.'
			: (disabledReason ?? 'Dictate');

	return (
		<PromptInputAction tooltip={tooltip} showTooltipWhenDisabled={isDisabled}>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className={cn('size-9 rounded-full text-foreground hover:bg-muted [&_svg]:size-5', className)}
				aria-label={tooltip}
				disabled={isDisabled}
				onClick={onVoiceModeRequest}
			>
				<Mic />
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

function PageContent(): ReactElement {
	const { mode, setMode } = useChatMode();
	const { sessionId: chatSessionId } = useChatSession();
	const navigate = useNavigate();
	const workspaceRef = useRef<HTMLDivElement>(null);
	const composerRef = useRef<HTMLDivElement>(null);
	const chatScrollRef = useRef<StickToBottomContext>(null);
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
	const [focusRequest, setFocusRequest] = useState(0);
	useEffect(() => {
		const requestFocus = (): void => setFocusRequest((current) => current + 1);
		window.addEventListener('kucedr:focus-chat-input', requestFocus);
		return () => window.removeEventListener('kucedr:focus-chat-input', requestFocus);
	}, []);
	useEffect(() => {
		if (focusRequest === 0 || agent.historyLoading) return;
		updateMode('chat');
		const frame = window.requestAnimationFrame(() => {
			composerRef.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [focusRequest, chatSessionId, agent.historyLoading, updateMode]);
	const dictation = useRealtimeDictation({
		value: agent.input,
		onValueChange: agent.setInput,
	});
	const recorder = useAudioRecorder();
	const voiceButtonMode = useVoiceButtonMode();
	const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
	const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
	const [detailsOpen, setDetailsOpen] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
	useEffect(() => {
		const query = window.matchMedia('(min-width: 1280px)');
		const onChange = (): void => setDetailsOpen(query.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	}, []);
	const compactDetails = useIsMobile('(max-width: 1200px)');
	const [detailsPopoverOpen, setDetailsPopoverOpen] = useState(false);
	const detailsDocked = detailsOpen && !compactDetails;
	const infoOpen = compactDetails ? detailsPopoverOpen : detailsOpen;
	const [modelContext, setModelContext] = useState<{ providerId: string; modelId: string; contextWindow?: number }>();
	const [capabilities, setCapabilities] = useState<AgentPromptInputCapabilities | null>();
	const filesAccept =
		capabilities === undefined ? undefined : capabilities?.rules.length ? capabilities.accept : '';
	useEffect(() => {
		let active = true;
		void window.agent
			.getPromptInputCapabilities()
			.then((result) => {
				if (active) setCapabilities(result);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [modelContext?.providerId, modelContext?.modelId]);
	const location = useLocation();
	const [openExtension, setOpenExtension] = useState<OpenExtension | null>(
		(location.state as { openExtension?: OpenExtension } | null)?.openExtension ?? null
	);
	useEffect(() => {
		if ((location.state as { openExtension?: OpenExtension } | null)?.openExtension) {
			navigate(location, { replace: true, state: null });
		}
	}, [location, navigate]);

	useEffect(() => {
		const open = (event: Event): void =>
			setOpenExtension((event as CustomEvent<OpenExtension>).detail);
		const close = (): void => setOpenExtension(null);
		const show = (): void => {
			close();
			updateMode('chat');
		};
		window.addEventListener('kucedr:open-extension', open);
		window.addEventListener('kucedr:focus-chat-input', close);
		window.addEventListener('kucedr:show-chat', show);
		return () => {
			window.removeEventListener('kucedr:open-extension', open);
			window.removeEventListener('kucedr:focus-chat-input', close);
			window.removeEventListener('kucedr:show-chat', show);
		};
	}, [updateMode]);
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
	const [transcriptionErrorMessage, setTranscriptionErrorMessage] = useState<string | null>(null);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);
	const [transcribingRecording, setTranscribingRecording] = useState(false);
	const transcriptionRunRef = useRef(0);
	const visibleMessages = useMemo(
		() => agent.chatState.messages.filter((message) => message.id !== welcomeMessage.id),
		[agent.chatState.messages]
	);
	const showEmptyConversation =
		visibleMessages.length === 0 && !agent.isLoading && !agent.historyLoading;
	useLayoutEffect(() => {
		const composer = composerRef.current;
		if (!composer) return;
		const updateSpacing = (): void => {
			workspaceRef.current?.style.setProperty('--composer-height', `${composer.offsetHeight}px`);
			const scrollState = chatScrollRef.current?.state;
			if (scrollState?.isAtBottom) scrollState.scrollTop = scrollState.calculatedTargetScrollTop;
		};
		updateSpacing();
		return resize(composer, updateSpacing);
	}, [showEmptyConversation]);
	const hasPromptText = agent.input.trim().length > 0;
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
		setAttachmentError(null);
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

	const addFiles = useCallback(
		(files: File[]): void => {
			const accepted = files.filter((file) => accepts(file.name, filesAccept));
			const rejected = files.filter((file) => !accepts(file.name, filesAccept));
			const limitError = attachmentLimitError(
				[...attachments.map((attachment) => attachment.file), ...accepted],
				capabilities?.rules ?? []
			);
			setAttachmentError(
				rejected.length > 0
					? `${rejected.map((file) => file.name).join(', ')} can't be attached to this model.`
					: (limitError ?? null)
			);
			if (!limitError) setAttachments((current) => [...current, ...filesToAttachments(accepted)]);
		},
		[attachments, capabilities, filesAccept]
	);

	const addLibraryFiles = useCallback(
		async (files: LibraryFile[]): Promise<void> => {
			try {
				// ponytail: reads every selected Library file before filtering; filter by name first if huge unsupported files get attached
				addFiles(
					await Promise.all(
						files.map(async (entry) => {
							const bytes = await window.agent.readPromptFile(entry.path);
							const file = new File([new Uint8Array(bytes)], entry.name, {
								type: workspaceFileType(entry.name).mimeType ?? '',
							});
							attachmentPath(file, entry.path);
							return file;
						})
					)
				);
			} catch {
				setAttachmentError('Could not attach Library files. Please try again.');
			}
		},
		[addFiles]
	);

	const submitPrompt = async (): Promise<void> => {
		if (agent.isLoading) {
			await agent.handleSubmit();
			return;
		}
		if (agent.modeIds.length > 0 && !hasPromptText) return;
		const unsupported = attachments.filter((attachment) => !accepts(attachment.file.name, filesAccept));
		const limitError = attachmentLimitError(
			attachments.map((attachment) => attachment.file),
			capabilities?.rules ?? []
		);
		if (unsupported.length > 0 || limitError) {
			setAttachmentError(
				unsupported.length > 0
					? `${unsupported.map((attachment) => attachment.file.name).join(', ')} can't be sent to this model. Remove it to send.`
					: (limitError ?? null)
			);
			return;
		}
		const submittedFiles = attachments.map((attachment) => attachment.file);
		saveDraftAttachments(chatSessionId, []);
		clearAttachments();
		await agent.handleSubmit(submittedFiles);
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

	const attachmentButton =
		voiceMode === 'dictation' ? undefined : (
			<AttachmentButton
				disabled={attachmentDisabled || filesAccept === ''}
				disabledReason={filesAccept === '' ? "This model doesn't accept files." : undefined}
				onLibrarySelect={() => setLibraryPickerOpen(true)}
				className={showEmptyConversation ? undefined : 'size-7 dark:hover:bg-accent'}
			/>
		);

	const modelSelect = (
		<div className="flex min-w-0 items-center text-[11px] text-muted-foreground">
			<StableModel onContext={setModelContext} compact={!showEmptyConversation} />
		</div>
	);

	const voiceButton = (
		<VoiceButton
			onVoiceModeRequest={() => void startDictation()}
			disabled={voiceBusy || agent.isLoading}
			disabledReason={voiceButtonDisabledReason}
			mode={voiceButtonMode}
			className={showEmptyConversation ? undefined : 'size-7 dark:hover:bg-accent [&_svg]:size-4'}
		/>
	);

	const composer = (
		<div
			ref={composerRef}
			data-slot="home-composer-shell"
			onDragOverCapture={(event) => {
				if (attachmentDisabled || !event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = 'copy';
			}}
			onDropCapture={(event) => {
				if (!event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
				event.preventDefault();
				event.stopPropagation();
				if (attachmentDisabled) return;
				setAttachmentError(null);
				void droppedLibraryFiles(event.dataTransfer.getData(LIBRARY_DRAG_TYPE)).then(addLibraryFiles).catch(() => setAttachmentError('Could not attach Library files. Please try again.'));
			}}
			className={cn(
				'z-20 flex justify-center',
				showEmptyConversation ? 'w-full shrink-0 px-2' : 'absolute inset-x-0 bottom-0 pb-2 pt-3'
			)}
		>
			{showEmptyConversation ? null : (
				<div className={cn('pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-10 max-w-4xl bg-background px-8 bg-clip-content', detailsDocked && 'max-w-[71.5rem] pr-[17.5rem]')} />
			)}
			<div className={cn('mx-auto w-full transition-[padding] duration-200 motion-reduce:transition-none', showEmptyConversation ? 'max-w-3xl px-8' : 'max-w-4xl px-8', !showEmptyConversation && detailsDocked && 'max-w-[71.5rem] pr-[17.5rem]')}>
				{attachmentError && <p role="alert" className="mb-2 text-xs text-destructive">{attachmentError}</p>}
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
				<div data-slot="home-composer-container" className="relative flex flex-col bg-background">
				{showEmptyConversation ? null : (
					<div className="pointer-events-none absolute inset-x-0 bottom-full h-12 bg-gradient-to-b from-transparent to-background" />
				)}
					<PromptEditor
						placeholder={showEmptyConversation ? 'Ask anything' : 'Send follow-up'}
						ariaLabel="Message your assistant"
						value={agent.input}
						expanded={false}
						onValueChange={agent.setInput}
						modes={agent.modes}
						modeIds={agent.modeIds}
						onModeIdsChange={agent.setModeIds}
						isLoading={agent.isLoading}
						maxHeight={360}
						onSubmit={() => void submitPrompt()}
						textareaRef={agent.inputRef}
						header={
							agent.replyTo ? (
								<ReplyPreview content={agent.replyTo.content} onCancel={agent.clearReply} />
							) : undefined
						}
						leadingAction={showEmptyConversation ? attachmentButton : undefined}
						belowContent={
							showEmptyConversation ? undefined : (
								<div className="flex items-center justify-between pt-0.5">
									<div className="flex items-center gap-1.5">
										{attachmentButton}
										{voiceButton}
									</div>
									<div className="flex min-w-0 items-center gap-1">
										{modelSelect}
										{modelContext?.modelId ? (
											<Usage
												className="h-7"
												providerId={modelContext.providerId}
												modelId={modelContext.modelId}
												contextWindow={modelContext.contextWindow}
												messages={agent.chatState.messages}
												draft={agent.input}
												hasAttachments={attachments.length > 0}
											/>
										) : null}
									</div>
								</div>
							)
						}
						voiceMode={voiceMode === 'dictation' ? voiceMode : null}
						voiceElapsedMs={activeVoiceElapsedMs}
						voiceMuted={activeVoiceMuted}
						voiceMediaStream={activeVoiceStream}
						voiceAnalyser={null}
						voiceStatus={activeDictationMode === 'record' ? 'Recording' : 'Listening'}
						voiceWaveformActive={true}
						onVoiceMutedChange={activeVoiceSetMuted}
						onVoiceCancel={() => void cancelDictation()}
						onVoiceConfirm={() => void confirmDictation()}
						onFilesChange={addFiles}
						filesAccept={filesAccept}
						wrapperClassName="max-w-none"
						detachedControls
						footerContent={showEmptyConversation ? modelSelect : undefined}
						className="w-full"
						inputClassName={cn(
							'rounded-xl px-2 pt-4',
							showEmptyConversation && 'min-h-[114px]'
						)}
						trailingAction={
							<PromptInputActions className="justify-end gap-1.5">
								{showEmptyConversation ? voiceButton : null}
								<PromptSubmit isLoading={agent.isLoading} onAction={() => void submitPrompt()} />
							</PromptInputActions>
						}
					/>
				</div>
			</div>
		</div>
	);

	const infoButton = (
		<Button type="button" variant={infoOpen ? 'secondary' : 'ghost'} size="icon" className="rounded-full" aria-label={infoOpen ? 'Hide chat information' : 'Show chat information'} aria-expanded={infoOpen} aria-controls="chat-information" onClick={compactDetails ? undefined : () => setDetailsOpen((open) => !open)}><Ellipsis className="size-4" strokeWidth={1.8} /></Button>
	);

	const chatDetails = (open: boolean, popover: boolean): ReactElement => (
		<ChatDetails open={open} popover={popover} onClose={() => (popover ? setDetailsPopoverOpen : setDetailsOpen)(false)} scroll={chatScrollRef} messages={visibleMessages} model={modelContext} draft={agent.input} hasAttachments={attachments.length > 0} onAttach={addLibraryFiles} onWorkspaceAttach={addFiles} onJump={(messageId, toolCallId) => {
			const scroll = chatScrollRef.current;
			const viewport = scroll?.scrollRef.current;
			const response = Array.from(scroll?.contentRef.current?.querySelectorAll<HTMLElement>('[data-chat-response]') ?? []).find((element) => element.dataset.chatResponse === messageId);
			const anchor = toolCallId ? Array.from(response?.querySelectorAll<HTMLElement>('[data-chat-script]') ?? []).find((element) => element.dataset.chatScript === toolCallId) : response;
			if (!scroll || !viewport || !anchor) return;
			setDetailsPopoverOpen(false);
			scroll.stopScroll();
			viewport.scrollTo({ top: viewport.scrollTop + anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 24, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
		}} />
	);

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split
				overlayNavigation={!openExtension}
				sidebar={
					<StableHomeSidebar
						refreshKey={`${chatSessionId}:${visibleMessages.length}:${agent.isLoading}`}
						openExtension={openExtension}
					/>
				}
			>
				{openExtension && (
					<ExtensionPage extension={openExtension} onClose={() => setOpenExtension(null)} />
				)}
				<div
					ref={workspaceRef}
					data-slot="home-workspace"
					className={cn(
						'@container/chat relative flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground',
						openExtension && 'hidden',
						showEmptyConversation && 'overflow-y-auto'
					)}
				>
					<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
						{agent.isLoading ? 'Kucedr is responding' : 'Kucedr is ready'}
					</span>
					{!showEmptyConversation && (
						<div className="absolute right-2 top-12 z-40 sm:right-3">
							<Popover open={compactDetails && detailsPopoverOpen} onOpenChange={setDetailsPopoverOpen}>
					<Tooltip>
						<TooltipTrigger render={compactDetails ? <PopoverTrigger asChild>{infoButton}</PopoverTrigger> : infoButton} />
						<TooltipContent side="bottom">{infoOpen ? 'Hide chat information' : 'Show chat information'}</TooltipContent>
					</Tooltip>
					<PopoverContent align="end" sideOffset={-32} className="w-64 border-0 bg-transparent p-0 shadow-lg">
						{chatDetails(true, true)}
					</PopoverContent>
				</Popover>
						</div>
					)}
					{showEmptyConversation ? (
						<div className="flex min-h-[calc(50dvh+7rem)] w-full shrink-0 flex-col justify-end gap-4 pb-6 pt-10">
							<div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4">
								<EmptyConversation />
							</div>
							{composer}
						</div>
					) : (
						<>
							<ChatContainerRoot
								className="min-h-0 p-0 [scrollbar-gutter:auto]"
								contextRef={chatScrollRef}
							>
								<ChatContainerContent className={cn('mx-auto min-h-full w-full max-w-4xl gap-5 px-12 pt-18 transition-[padding] duration-200 motion-reduce:transition-none', detailsDocked && 'pr-[18.5rem] max-w-[71.5rem]')}>
									<Messages
										messages={visibleMessages}
										isLoading={agent.isLoading}
										voiceMode={voiceMode !== null}
										activeAgentId={agent.chatState.activeAgentId}
										onEdit={agent.editUserMessage}
										onReply={agent.replyToMessage}
										modes={agent.modes}
										onAction={agent.runModeAction}
									/>
									<ChatContainerScrollAnchor className="h-[calc(var(--composer-height,7rem)+3rem)]" />
								</ChatContainerContent>
								<ChatOutline key={chatSessionId} messages={visibleMessages} />
								<div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--composer-height,7rem)+0.75rem)] z-30 px-4">
									<div className={cn('mx-auto flex w-full max-w-4xl justify-center transition-[padding] duration-200 motion-reduce:transition-none', detailsDocked && 'max-w-[71.5rem] pr-[15.5rem]')}>
										<ScrollButton
											type="button"
											aria-label="Scroll to latest"
											className="pointer-events-auto dark:bg-muted dark:hover:bg-accent"
										/>
									</div>
								</div>
								{compactDetails ? null : chatDetails(detailsOpen, false)}
							</ChatContainerRoot>
							{composer}
						</>
					)}
				</div>
			</Split>
			<LibraryPicker
				open={libraryPickerOpen}
				onOpenChange={setLibraryPickerOpen}
				onSelect={addLibraryFiles}
			/>
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
