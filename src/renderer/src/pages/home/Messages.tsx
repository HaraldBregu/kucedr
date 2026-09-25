import { memo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Markdown } from '@/components/prompt-kit/markdown';
import type { HomeChatMessage } from './context/state';
import { AssistantMessage } from './components/AssistantMessage';
import { markdownComponents } from './components/markdown';
import { UserMessage } from './components/UserMessage';

export const Messages = memo(function Messages({
	messages,
	isLoading,
	voiceMode,
	activeAgentId,
	onEdit,
	onReply,
	onImplement,
}: {
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
	readonly onImplement: () => void;
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
						<UserMessage
							key={message.id}
							content={message.content}
							attachments={message.attachments}
							canEdit={!isLoading && !voiceMode}
							onEdit={(content) => onEdit(message.id, userOffsetFromEnd, content)}
						/>
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
						key={message.id}
						message={message}
						isStreaming={isLoading && message.id === activeAgentId}
						showHeader={showAssistantHeader}
						className={groupedAssistantClassName}
						onReply={onReply}
						canImplement={
							index === messages.length - 1 && message.state === 'completed' && !isLoading
						}
						onImplement={onImplement}
					/>
				);
			})}
		</>
	);
});
