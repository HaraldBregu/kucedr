import { Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatContainerContent, ChatContainerRoot } from '@/components/ui/chat-container';
import { Composer } from './Composer';
import { Interaction } from './Interaction';
import { Transcript } from './Transcript';
import type { Workspace } from './workspace';

export function Chat({
	coding,
	onConfiguration,
}: {
	coding: Workspace;
	onConfiguration: () => void;
}) {
	const project = coding.projects.find((item) => item.id === coding.projectId);
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
				<h2 className="min-w-0 flex-1 truncate text-sm font-medium">
					{coding.snapshot?.session.title || 'New session'}
				</h2>
			</header>
			<ChatContainerRoot className="min-h-0">
				<ChatContainerContent className="p-4">
					{coding.loading ? (
						<p role="status" className="text-sm text-muted-foreground">
							Loading…
						</p>
					) : coding.blocks.length ? (
						<Transcript blocks={coding.blocks} />
					) : (
						<div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
							<Code2 className="size-7 text-muted-foreground" />
							<h2 className="text-lg font-semibold">
								{project ? 'What are we building?' : 'Open a project'}
							</h2>
							<p className="text-sm text-muted-foreground">
								{project
									? 'Start with a prompt or switch to Command.'
									: 'Choose a workspace in the navigation bar.'}
							</p>
							{project && !coding.settings?.modelId && (
								<Button variant="outline" onClick={onConfiguration}>
									Configure agent
								</Button>
							)}
						</div>
					)}
					{coding.interactions.map((item) => (
						<Interaction key={item.requestId} request={item} onRespond={coding.respond} />
					))}
					{coding.busy && (
						<p role="status" className="mt-4 text-xs text-muted-foreground">
							{coding.status}
						</p>
					)}
					{coding.error && (
						<p role="alert" className="mt-4 text-sm text-destructive">
							{coding.error}
						</p>
					)}
				</ChatContainerContent>
			</ChatContainerRoot>
			<Composer coding={coding} onConfiguration={onConfiguration} />
		</div>
	);
}
