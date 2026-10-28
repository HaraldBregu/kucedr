import { Activity, ArrowUpRight, ChevronDown, File, Files, Gauge, Hash, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { HomeChatMessage } from './context/state';
import { chatAssets } from './components/assets';
import { statusLabel } from './components/status';
import { Usage } from './Usage';
import { ChatLibrary } from './Library';
import type { LibraryFile } from '@shared/library_types';

export function ChatDetails({ messages, onJump, onAttach }: {
	readonly messages: readonly HomeChatMessage[];
	readonly onJump: (messageId: string) => void;
	readonly onAttach: (files: LibraryFile[]) => void;
}): React.JSX.Element {
	const responses = messages.filter((message) => message.role === 'agent');
	const latest = responses.at(-1);
	const context = responses.findLast((message) => message.contextUsage)?.contextUsage;
	const assets = chatAssets(responses);
	return (
		<aside aria-label="Chat information" className="absolute right-6 top-6 hidden max-h-[calc(100%-3rem)] w-72 overflow-y-auto @[1408px]/chat:block">
			<Card size="sm" className="gap-0 rounded-2xl border border-border bg-card ring-0 data-[size=sm]:py-0">
				<CardContent className="space-y-2 py-3 text-sm">
					<div className="flex min-h-7 items-center gap-2 text-muted-foreground">
						<MessageSquare className="size-4 shrink-0" aria-hidden />
						<span className="flex-1">Responses</span>
						<span className="tabular-nums text-foreground">{responses.length}</span>
					</div>
					{latest && <div className="flex min-h-7 items-start gap-2 text-muted-foreground">
						<Activity className="mt-0.5 size-4 shrink-0" aria-hidden />
						<div className="min-w-0"><p className="text-xs">Latest response</p><p className="mt-0.5 text-foreground" role="status">{statusLabel(latest)}</p></div>
					</div>}
					{latest?.outputTokens !== undefined && <div className="flex min-h-7 items-center gap-2 text-muted-foreground"><Hash className="size-4 shrink-0" aria-hidden /><span className="flex-1">Output tokens</span><span className="tabular-nums text-foreground">{latest.outputTokens.toLocaleString()}</span></div>}
					<div className="flex min-h-7 items-center gap-2 text-muted-foreground">
						<Gauge className="size-4 shrink-0" aria-hidden />
						<span className="flex-1">Context</span>
						<Usage className="h-7 rounded-md px-0 text-xs tabular-nums text-foreground" providerId={context?.providerId ?? ''} modelId={context?.modelId ?? ''} contextWindow={context?.contextWindow} messages={messages} draft="" hasAttachments={false} />
					</div>
				</CardContent>
				<Collapsible defaultOpen className="border-t border-border">
					<CollapsibleTrigger render={<Button variant="ghost" className="group h-10 w-full justify-start gap-2 rounded-none px-3 font-medium aria-expanded:bg-transparent" />}>
						<Files className="size-4 text-muted-foreground" aria-hidden />
						<span className="flex-1 text-left">Generated assets</span>
						<span className="text-xs tabular-nums text-muted-foreground">{assets.length}</span>
						<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="space-y-0.5 px-1 pb-2">
							{assets.length ? assets.map(({ path, messageId }) => <Button key={path} variant="ghost" className="h-9 w-full justify-start gap-2 px-2 font-normal" title={`Show in conversation: ${path}`} onClick={() => onJump(messageId)}>
								<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40"><File className="size-3.5 text-muted-foreground" aria-hidden /></span>
								<span className="min-w-0 flex-1 truncate text-left text-xs">{path.replace(/\\/g, '/').split('/').at(-1)}</span>
								<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
							</Button>) : <p className="px-2 pb-1 text-xs text-muted-foreground">No generated assets yet.</p>}
						</div>
					</CollapsibleContent>
				</Collapsible>
				<ChatLibrary refreshKey={`${latest?.id}:${latest?.completedAtMs}:${assets.map((asset) => asset.path).join('\n')}`} onAttach={onAttach} />
			</Card>
		</aside>
	);
}
