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
import { Info } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LibraryFile } from '../../../../shared/library_types';
import { PageContainer, Split } from '@/components/app/base/page';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
	ChatContainerContent,
	ChatContainerRoot,
	ChatContainerScrollAnchor,
} from '@/components/ui/chat-container';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { LogoView } from '@/components/app/base/logo-view';
import { ScrollButton } from '@/components/ui/scroll-button';
import { useChatMode } from '@/contexts/chat-mode';
import { useChatSession } from '@/contexts/chat-session';
import { cn } from '@/lib/utils';
import type { StickToBottomContext } from '@/hooks/use-stick-to-bottom';
import { ReplyPreview } from './components/Reply';
import { Messages } from './Messages';
import { ChatOutline } from './Outline';
import { ChatDetails } from './Details';
import { Composer } from './Composer';
import { Provider, welcomeMessage } from './context';
import { useHomeAgent } from './hooks';
import type { PromptAttachment } from './attachments/types';
import { libraryAttachments } from './attachments/entries';
import { filesToAttachments } from './attachments/files';
import { attachmentId } from './attachments/id';
import { attachmentPath } from './attachments/path';
import { readDraftAttachments } from './attachments/read';
import { saveDraftAttachments } from './attachments/save';
import { HomeSidebar } from './Sidebar';
import { ExtensionPage, type OpenExtension } from './components/ExtensionPage';

const StableHomeSidebar = memo(HomeSidebar);

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
	const agent = useHomeAgent({ setMode });
	const [focusRequest, setFocusRequest] = useState(0);
	useEffect(() => {
		const requestFocus = (): void => setFocusRequest((current) => current + 1);
		window.addEventListener('kucedr:focus-chat-input', requestFocus);
		return () => window.removeEventListener('kucedr:focus-chat-input', requestFocus);
	}, []);
	useEffect(() => {
		if (focusRequest === 0 || agent.historyLoading) return;
		setMode('chat');
		const frame = window.requestAnimationFrame(() => {
			composerRef.current?.querySelector<HTMLElement>('[role="textbox"]')?.focus();
		});
		return () => window.cancelAnimationFrame(frame);
	}, [focusRequest, chatSessionId, agent.historyLoading, setMode]);
	const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
	const [detailsOpen, setDetailsOpen] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
	useEffect(() => {
		const query = window.matchMedia('(min-width: 1280px)');
		const onChange = (): void => setDetailsOpen(query.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	}, []);
	const [modelContext, setModelContext] = useState<{ providerId: string; modelId: string; contextWindow?: number }>();
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
			setMode('chat');
		};
		window.addEventListener('kucedr:open-extension', open);
		window.addEventListener('kucedr:focus-chat-input', close);
		window.addEventListener('kucedr:show-chat', show);
		return () => {
			window.removeEventListener('kucedr:open-extension', open);
			window.removeEventListener('kucedr:focus-chat-input', close);
			window.removeEventListener('kucedr:show-chat', show);
		};
	}, [setMode]);
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
	const hasGoalObjective = agent.input.replace(/^\/goal\s*/i, '').trim().length > 0;

	useEffect(() => () => setMode('chat'), [setMode]);

	const clearAttachments = useCallback((): void => {
		setAttachments((current) => {
			for (const attachment of current) {
				if (attachment.url) URL.revokeObjectURL(attachment.url);
			}
			return [];
		});
	}, []);

	const addLibraryFiles = useCallback((files: LibraryFile[]): void => {
		setAttachments((current) => [...current, ...libraryAttachments(files)]);
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

	const composer = (
		<div
			ref={composerRef}
			data-slot="home-composer-shell"
			className={cn(
				'z-20 flex justify-center px-4',
				showEmptyConversation ? 'w-full shrink-0' : 'absolute inset-x-0 bottom-0 pb-5 pt-3'
			)}
		>
			{showEmptyConversation ? null : (
				<div className={cn('pointer-events-none absolute inset-x-4 bottom-0 mx-auto h-10 max-w-3xl bg-background', detailsOpen && 'max-w-[60.5rem] pr-[12.5rem] bg-clip-content')} />
			)}
			<Composer
				className={cn('mx-auto w-full transition-[padding] duration-200 motion-reduce:transition-none', showEmptyConversation ? 'max-w-2xl' : 'max-w-3xl', !showEmptyConversation && detailsOpen && 'max-w-[60.5rem] pr-[12.5rem]')}
				fade={!showEmptyConversation}
				placeholder={showEmptyConversation ? 'Ask anything' : 'Send follow-up'}
				ariaLabel="Message your assistant"
				value={agent.input}
				onValueChange={agent.setInput}
				onPlanCommandChange={(active) => {
					setPlanCommandActive(active);
					agent.setInteractionMode(active ? 'plan' : 'default');
				}}
				onGoalCommandChange={setGoalCommandActive}
				isLoading={agent.isLoading}
				mode={mode}
				setMode={setMode}
				attachments={attachments}
				setAttachments={setAttachments}
				onSubmit={() => void submitPrompt()}
				textareaRef={agent.inputRef}
				header={
					agent.replyTo ? (
						<ReplyPreview content={agent.replyTo.content} onCancel={agent.clearReply} />
					) : undefined
				}
				messages={agent.chatState.messages}
				onContext={setModelContext}
				inputClassName={cn(
					showEmptyConversation && 'min-h-[114px]',
					planCommandActive && 'plan-prompt-frame',
					goalCommandActive && 'goal-prompt-frame'
				)}
			/>
		</div>
	);

	return (
		<PageContainer className="overflow-hidden text-foreground">
			<Split
				navigationActions={!showEmptyConversation && !openExtension ? <Tooltip>
					<TooltipTrigger render={<Button type="button" variant={detailsOpen ? 'secondary' : 'ghost'} size="icon" className="rounded-full" aria-label={detailsOpen ? 'Hide chat information' : 'Show chat information'} aria-expanded={detailsOpen} aria-controls="chat-information" onClick={() => setDetailsOpen((open) => !open)}><Info className="size-4" strokeWidth={1.8} /></Button>} />
					<TooltipContent side="bottom">{detailsOpen ? 'Hide chat information' : 'Show chat information'}</TooltipContent>
				</Tooltip> : undefined}
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
								<ChatContainerContent className={cn('mx-auto min-h-full w-full max-w-3xl gap-5 pl-10 pr-4 pt-6 transition-[padding] duration-200 motion-reduce:transition-none', detailsOpen && 'pr-[16.5rem] max-w-[calc(48rem+12.5rem)]')}>
									<Messages
										messages={visibleMessages}
										isLoading={agent.isLoading}
										voiceMode={mode === 'voice'}
										activeAgentId={agent.chatState.activeAgentId}
										onEdit={agent.editUserMessage}
										onReply={agent.replyToMessage}
										onImplement={agent.implementPlan}
									/>
									<ChatContainerScrollAnchor className="h-[calc(var(--composer-height,7rem)+3rem)]" />
								</ChatContainerContent>
								<ChatOutline key={chatSessionId} messages={visibleMessages} />
								<div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--composer-height,7rem)+0.75rem)] z-30 px-4">
									<div className={cn('mx-auto flex w-full max-w-3xl justify-center transition-[padding] duration-200 motion-reduce:transition-none', detailsOpen && 'max-w-[60.5rem] pr-[12.5rem]')}>
										<ScrollButton
											type="button"
											aria-label="Scroll to latest"
											className="pointer-events-auto dark:bg-muted dark:hover:bg-accent"
										/>
									</div>
								</div>
								<ChatDetails open={detailsOpen} messages={visibleMessages} model={modelContext} draft={agent.input} hasAttachments={attachments.length > 0}onAttach={addLibraryFiles} onWorkspaceAttach={(files) => setAttachments((current) => [...current, ...filesToAttachments(files)])} onJump={(messageId, toolCallId) => {
									const scroll = chatScrollRef.current;
									const viewport = scroll?.scrollRef.current;
									const response = Array.from(scroll?.contentRef.current?.querySelectorAll<HTMLElement>('[data-chat-response]') ?? []).find((element) => element.dataset.chatResponse === messageId);
									const anchor = toolCallId ? Array.from(response?.querySelectorAll<HTMLElement>('[data-chat-script]') ?? []).find((element) => element.dataset.chatScript === toolCallId) : response;
									if (!scroll || !viewport || !anchor) return;
									scroll.stopScroll();
									viewport.scrollTo({ top: viewport.scrollTop + anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 24, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
								}} />
							</ChatContainerRoot>
							{composer}
						</>
					)}
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
