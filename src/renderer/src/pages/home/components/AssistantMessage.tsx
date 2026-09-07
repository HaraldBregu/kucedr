import { useState, type ReactElement, type ReactNode } from 'react';
import { defaultUrlTransform } from 'react-markdown';
import { AudioPlayer } from '@/components/audio-player';
import { VideoPlayer } from '@/components/video-player';
import { Copy, Reply, Volume2 } from 'lucide-react';
import { Markdown } from '@/components/prompt-kit/markdown';
import { Message, MessageActions } from '@/components/prompt-kit/message';
import { TextShimmer } from '@/components/prompt-kit/text-shimmer';
import { ToolActivityGroup } from './ToolActivityGroup';
import { ToolPermissionCard } from './ToolPermissionCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type AgentMessage, type AgentToolPart } from '../context';
import { useReadMessageAloud } from '../hooks';
import { markdownComponents } from './markdown';
import { statusLabel, isRunningState, stateTone } from './status';
import { UserInputCard } from './UserInputCard';
import { parsePlanEnvelope } from './plan';

const LONG_MESSAGE_LENGTH = 600;

function generatedMediaPaths(tools: readonly AgentToolPart[]): string[] {
	return tools
		.filter(
			(tool) =>
				(tool.type === 'create_image' ||
					tool.type === 'create_video' ||
					tool.type === 'create_sound') &&
				tool.state === 'output-available'
		)
		.map((tool) => imagePathFromOutput(tool.output))
		.filter((path): path is string => typeof path === 'string' && path.length > 0);
}

function isVideoPath(path: string): boolean {
	return /\.(mp4|webm|mov|m4v|ogv)$/i.test(path);
}

function isAudioPath(path: string): boolean {
	return /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/i.test(path);
}

// While streaming, tool.output is the structured result object; once the message
// is rebuilt from persisted history it arrives as a JSON string, so accept both.
function imagePathFromOutput(output: unknown): string | undefined {
	let value = output;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	const path = (value as { path?: unknown } | null | undefined)?.path;
	return typeof path === 'string' ? path : undefined;
}

function isLocalImagePath(value: string): boolean {
	return (
		/^[A-Za-z]:[\\/]/.test(value) || // Windows drive path (C:\... or C:/...)
		value.startsWith('\\\\') || // Windows UNC path
		value.startsWith('/') // POSIX absolute path
	);
}

function localResourceUrl(path: string): string {
	// The host selects how the main process resolves the path: 'file' for an
	// absolute path, 'agent' for a path relative to the agent data directory. The
	// host is required because local-resource is a standard scheme, so without it
	// Chromium would swallow the first path segment as the URL host.
	const posixPath = path.replace(/\\/g, '/');
	if (!isLocalImagePath(path)) {
		const url = new URL('local-resource://agent/');
		url.pathname = `/${posixPath.replace(/^\/+/, '')}`;
		return url.toString();
	}
	// Windows paths start with a drive letter (C:\...) rather than a slash, so add
	// a leading slash to produce a valid slash-separated pathname.
	const absolutePath = posixPath.startsWith('/') ? posixPath : `/${posixPath}`;
	const url = new URL('local-resource://file/');
	url.pathname = absolutePath;
	return url.toString();
}

// react-markdown drops URLs whose scheme is not in its safe list, and a Windows
// drive letter (C:) looks exactly like a scheme, so preserve local file paths and
// defer to the default transform for everything else.
function transformImageUrl(url: string): string {
	return isLocalImagePath(url) ? url : defaultUrlTransform(url);
}

function resolveLocalImagePath(
	src: string | undefined,
	imagePaths: readonly string[]
): string | undefined {
	if (!src) return undefined;
	const isWindowsDrivePath = /^[A-Za-z]:[\\/]/.test(src);
	if (!isWindowsDrivePath && /^[a-z][a-z0-9+.-]*:/i.test(src)) return undefined;
	let decoded = src;
	try {
		decoded = decodeURIComponent(src);
	} catch {
		// keep src as-is when it contains malformed percent sequences
	}
	const decodedPosix = decoded.replace(/\\/g, '/');
	const matched = imagePaths.find((path) => {
		const posix = path.replace(/\\/g, '/');
		return posix === decodedPosix || posix.endsWith(`/${decodedPosix}`);
	});
	if (matched) return matched;
	return undefined;
}

function isSkillTool(tool: AgentToolPart): boolean {
	return tool.type.toLowerCase().includes('skill');
}

function fileName(path: string): string {
	return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

// The create_image tool displays its result automatically via the standalone
// block. Suppress that only when the model actually embeds the file as a markdown
// image (![...](...)); a plain-text mention or link must not hide the image.
function contentEmbedsImage(content: string, path: string): boolean {
	const name = fileName(path);
	if (!name) return false;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`!\\[[^\\]]*\\]\\(<?[^\\n]*${escaped}`).test(content);
}

function normalizeImageLinks(content: string): string {
	return content.replace(/!\[([^\]]*)\]\(([^()\n]+)\)/g, (match, alt: string, dest: string) => {
		// react-markdown's default urlTransform strips file: URLs, so rewrite
		// them to plain absolute paths served via local-resource://. Windows paths
		// use backslashes, which the markdown parser percent-encodes and mangles, so
		// switch local paths to forward slashes before they reach the parser.
		let destination = dest.trim().replace(/^file:\/\//i, '');
		if (isLocalImagePath(destination)) {
			destination = destination.replace(/\\/g, '/');
		}
		if (destination.includes(' ') && !destination.startsWith('<')) {
			destination = `<${destination}>`;
		}
		return destination === dest.trim() ? match : `![${alt}](${destination})`;
	});
}

function statusLabelContent(message: AgentMessage, isStreaming: boolean, label: string): ReactNode {
	if (isStreaming && isRunningState(message.state)) {
		return <TextShimmer className="text-sm">{label}</TextShimmer>;
	}

	return label;
}

export function AssistantMessage({
	message,
	isStreaming = false,
	collapseLongContent = false,
	className,
	onReply,
	canImplement = false,
	onImplement,
}: {
	readonly message: AgentMessage;
	readonly isStreaming?: boolean;
	readonly showHeader?: boolean;
	readonly collapseLongContent?: boolean;
	readonly className?: string;
	readonly onReply?: (message: Pick<AgentMessage, 'id' | 'content'>) => void;
	readonly canImplement?: boolean;
	readonly onImplement?: () => void;
}): ReactElement {
	const canToggleContent =
		collapseLongContent && message.content.trim().length > LONG_MESSAGE_LENGTH;
	const [isContentExpanded, setIsContentExpanded] = useState(false);
	const { speak, isSpeaking, errorMessage: speakErrorMessage, clearError } = useReadMessageAloud();

	const parsedPlan = parsePlanEnvelope(message.content, isStreaming);
	const displayContent = parsedPlan.kind === 'markdown' ? message.content : parsedPlan.content;
	const hasContent = displayContent.length > 0 || parsedPlan.kind === 'complete';
	const messageText = displayContent.trim();
	const hasTools = message.tools.length > 0;
	const skillTools = message.tools.filter(isSkillTool);
	const questionTools = message.tools.filter((tool) => tool.type === 'ask');
	const otherTools = message.tools.filter((tool) => !isSkillTool(tool) && tool.type !== 'ask');
	const mediaPaths = generatedMediaPaths(message.tools);
	const standaloneMediaPaths = mediaPaths.filter(
		(path) => !contentEmbedsImage(message.content, path)
	);
	const messageMarkdownComponents = {
		...markdownComponents,
		img: ({ src, alt }: { src?: string; alt?: string }) => {
			const localPath = resolveLocalImagePath(src, mediaPaths);
			const safeSource = src && !isLocalImagePath(src) ? src : undefined;
			if (localPath && isAudioPath(localPath)) {
				return (
					<AudioPlayer
						src={localResourceUrl(localPath)}
						className="mb-4 mt-2"
						onContextMenu={() => void window.app.showAudioContextMenu(localPath)}
					/>
				);
			}
			if (localPath && isVideoPath(localPath)) {
				return (
					<VideoPlayer
						src={localResourceUrl(localPath)}
						controls
						className="mb-4 mt-2 w-full overflow-hidden rounded-xl border border-border/50"
						onOpenFile={() => void window.app.openVideo(localPath)}
						onContextMenu={() => void window.app.showVideoContextMenu(localPath)}
					/>
				);
			}
			return (
				<img
					src={localPath ? localResourceUrl(localPath) : safeSource}
					alt={alt ?? ''}
					className="my-2 h-auto max-w-full rounded-lg border border-border/50"
					onContextMenu={
						localPath ? () => void window.app.showImageContextMenu(localPath) : undefined
					}
				/>
			);
		},
	};
	const showActivity =
		hasTools ||
		(message.state !== 'idle' && message.state !== 'completed') ||
		Boolean(message.errorText);
	const label = statusLabel(message);
	const labelContent = statusLabelContent(message, isStreaming, label);
	const statusClassName = cn(
		'inline-flex min-h-6 max-w-full items-center rounded-full px-2 py-0.5 text-xs font-semibold',
		stateTone(message.state)
	);

	const copyMessage = (): void => {
		if (messageText.length === 0) return;
		void (async () => {
			if (navigator.clipboard?.writeText) {
				const copied = await navigator.clipboard.writeText(messageText).then(
					() => true,
					() => false
				);
				if (copied) return;
			}

			const textarea = document.createElement('textarea');
			textarea.value = messageText;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		})();
	};

	const speakMessage = (): void => {
		if (messageText.length === 0 || isSpeaking) return;
		clearError();
		speak(message.content);
	};

	const readAloudTitle =
		speakErrorMessage ?? (isSpeaking ? 'Reading message aloud' : 'Read message aloud');

	return (
		<Message className={cn('flex w-full flex-col', className)}>
			{skillTools.length > 0 && <ToolActivityGroup tools={skillTools} />}
			{otherTools.length > 0 && <ToolActivityGroup tools={otherTools} />}
			{questionTools.map((tool) => (
				<UserInputCard
					key={tool.toolCallId}
					tool={tool}
					pending={
						message.pendingUserInput?.toolCallId === tool.toolCallId
							? message.pendingUserInput
							: undefined
					}
				/>
			))}
			{message.pendingPermission && (
				<ToolPermissionCard
					key={message.pendingPermission.toolCallId}
					permission={message.pendingPermission}
				/>
			)}
			{standaloneMediaPaths.length > 0 && (
				<div className="flex w-full flex-col gap-2">
					{standaloneMediaPaths.map((path) => {
						if (isAudioPath(path)) {
							return (
								<AudioPlayer
									key={path}
									src={localResourceUrl(path)}
									className="mb-4"
									onContextMenu={() => void window.app.showAudioContextMenu(path)}
								/>
							);
						}
						return isVideoPath(path) ? (
							<VideoPlayer
								key={path}
								src={localResourceUrl(path)}
								controls
								className="mb-4 w-full overflow-hidden rounded-xl border border-border/50"
								onOpenFile={() => void window.app.openVideo(path)}
								onContextMenu={() => void window.app.showVideoContextMenu(path)}
							/>
						) : (
							<img
								key={path}
								src={localResourceUrl(path)}
								alt="Generated image"
								className="h-auto max-w-full rounded-lg border border-border/50"
								onContextMenu={() => void window.app.showImageContextMenu(path)}
							/>
						);
					})}
				</div>
			)}
			{hasContent && (
				<>
					<div
						id={`assistant-message-${message.id}-content`}
						data-slot="assistant-message-content"
						className={cn(
							'relative min-w-0 max-w-full',
							canToggleContent && !isContentExpanded && 'max-h-40 overflow-hidden'
						)}
					>
						{parsedPlan.kind === 'complete' ? (
							<Card className="w-full gap-4 border-info/30 py-4">
								<CardHeader className="px-4">
									<CardTitle className="text-sm">Proposed plan</CardTitle>
								</CardHeader>
								<CardContent className="px-4">
									<Markdown
										className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]"
										components={messageMarkdownComponents}
										urlTransform={transformImageUrl}
									>
										{normalizeImageLinks(displayContent)}
									</Markdown>
								</CardContent>
								{canImplement && onImplement ? (
									<CardFooter className="justify-end px-4">
										<Button type="button" size="sm" onClick={onImplement}>
											Implement
										</Button>
									</CardFooter>
								) : null}
							</Card>
						) : displayContent ? (
							<Markdown
								className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]"
								components={messageMarkdownComponents}
								urlTransform={transformImageUrl}
							>
								{normalizeImageLinks(displayContent)}
							</Markdown>
						) : null}
					</div>
					{canToggleContent ? (
						<Button
							type="button"
							variant="ghost"
							size="xs"
							className="self-start text-muted-foreground hover:text-foreground"
							aria-expanded={isContentExpanded}
							aria-controls={`assistant-message-${message.id}-content`}
							onClick={() => setIsContentExpanded((expanded) => !expanded)}
						>
							{isContentExpanded ? 'Less' : 'More'}
						</Button>
					) : null}
					<MessageActions className="mt-1 gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="text-muted-foreground hover:text-foreground"
							aria-label="Copy message"
							title="Copy message"
							onClick={copyMessage}
						>
							<Copy className="size-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className={cn(
								'text-muted-foreground hover:text-foreground',
								speakErrorMessage && 'text-destructive hover:text-destructive'
							)}
							aria-label="Read message aloud"
							title={readAloudTitle}
							disabled={isSpeaking}
							onClick={speakMessage}
						>
							<Volume2 className="size-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="text-muted-foreground hover:text-foreground"
							aria-label="Reply"
							title="Reply"
							disabled={!onReply || !messageText}
							onClick={() => onReply?.({ id: message.id, content: messageText })}
						>
							<Reply className="size-3.5" />
						</Button>
					</MessageActions>
				</>
			)}
			{showActivity && !hasTools && (
				<div className="flex w-full flex-col">
					<span className={statusClassName}>{labelContent}</span>
				</div>
			)}
		</Message>
	);
}
