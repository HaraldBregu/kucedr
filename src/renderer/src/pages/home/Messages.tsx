import { memo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentModeInfo } from '@shared/agent_types';
import { Markdown } from '@/components/prompt-kit/markdown';
import type { HomeChatMessage } from './context/state';
import { AssistantMessage } from './components/AssistantMessage';
import { markdownComponents } from './components/markdown';
import { UserMessage } from './components/UserMessage';

export const Messages = memo(function Messages({
	sessionId,
	messages,
	isLoading,
	voiceMode,
	activeAgentId,
	onEdit,
	onReply,
	onRegenerate,
	modes,
	onAction,
}: {
	readonly sessionId?: string;
	readonly messages: readonly HomeChatMessage[];
	readonly isLoading: boolean;
	readonly voiceMode: boolean;
	readonly activeAgentId?: string;
	readonly onEdit: (
		messageId: string,
		userOffsetFromEnd: number,
		content: string
	) => Promise<boolean>;
	readonly onReply: (message: { id: string; content: string }) => void;
	readonly onRegenerate: (messageId: string) => Promise<boolean>;
	readonly modes: readonly AgentModeInfo[];
	readonly onAction: (prompt: string) => void;
}): ReactElement {
	const { t } = useTranslation();
	return (
		<>
			{messages.map((message, index) => {
				const previous = index > 0 ? messages[index - 1] : null;
				const showAssistantHeader = !previous || previous.role !== 'agent';
				const groupedAssistantClassName = showAssistantHeader ? undefined : '-mt-5';

				if (message.role === 'user') {
					const userOffsetFromEnd = messages
						.slice(index + 1)
						.filter((nextMessage) => nextMessage.role === 'user').length;
					return (
						<div key={message.id} data-chat-turn={message.id}>
							{message.compaction && (
								<details className="mb-4 border-y border-border py-2 text-sm text-muted-foreground">
									<summary className="cursor-pointer">{t('settings.chatHistory.automaticallySummarized')}</summary>
									<p className="mt-2 whitespace-pre-wrap break-words">{message.compaction.summary}</p>
								</details>
							)}
							<UserMessage
								content={message.content}
								attachments={message.attachments}
								followUp={message.followUp}
								canEdit={!isLoading && !voiceMode}
								onEdit={(content) => onEdit(message.id, userOffsetFromEnd, content)}
							/>
						</div>
					);
				}

				if (message.role === 'summary') {
					return (
						<section
							key={message.id}
							aria-label={t('settings.chatHistory.summary')}
							className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
						>
							<p className="mb-1 text-xs font-medium uppercase tracking-wide text-foreground">
								{t('settings.chatHistory.summary')}
							</p>
							<Markdown
								className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]"
								components={markdownComponents}
							>
								{message.content}
							</Markdown>
						</section>
					);
				}

				return (
					<AssistantMessage
						sessionId={sessionId}
						key={message.id}
						message={message}
						isStreaming={isLoading && message.id === activeAgentId}
						showHeader={showAssistantHeader}
						className={groupedAssistantClassName}
						onReply={onReply}
						canRegenerate={!isLoading && !voiceMode}
						onRegenerate={
							messages.slice(0, index).some((earlier) => earlier.role === 'user')
								? () => {
										if (
											messages.slice(index + 1).some((later) => later.role === 'user') &&
											!window.confirm(t('chat.regenerate.confirm'))
										)
											return;
										void onRegenerate(message.id);
									}
								: undefined
						}
						modes={modes}
						canAct={index === messages.length - 1 && message.state === 'completed' && !isLoading}
						onAction={onAction}
					/>
				);
			})}
		</>
	);
});
