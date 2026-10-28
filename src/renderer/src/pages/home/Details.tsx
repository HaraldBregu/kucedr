import { ArrowUpRight, ChevronDown, File, FileCode, Files, Gauge, Hash, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { HomeChatMessage } from './context/state';
import { chatAssets } from './components/assets';
import { chatScripts } from './components/scripts';
import { Usage } from './Usage';
import { ChatLibrary } from './Library';
import { ChatWorkspace } from './Workspace';
import type { LibraryFile } from '@shared/library_types';

export function ChatDetails({ open, messages, model, draft, hasAttachments, onJump, onAttach, onWorkspaceAttach }: {
	readonly open: boolean;
	readonly messages: readonly HomeChatMessage[];
	readonly model?: { providerId: string; modelId: string; contextWindow?: number };
	readonly draft: string;
	readonly hasAttachments: boolean;
	readonly onJump: (messageId: string, toolCallId?: string) => void;
	readonly onAttach: (files: LibraryFile[]) => void;
	readonly onWorkspaceAttach: (files: File[]) => void;
}): React.JSX.Element {
	const responses = messages.filter((message) => message.role === 'agent');
	const latest = responses.at(-1);
	const context = responses.findLast((message) => message.contextUsage)?.contextUsage;
	const assets = chatAssets(responses);
	const scripts = chatScripts(responses);
	return (
		<aside id="chat-information" aria-label="Chat information" className={`absolute right-6 top-6 z-20 max-h-[calc(100%-3rem)] w-56 max-w-[calc(100%-3rem)] overflow-y-auto ${open ? 'block' : 'hidden'}`}>
			<Card size="sm" className="rounded-2xl border border-border bg-card ring-0 data-[size=sm]:gap-0">
				<CardContent className="space-y-2 pb-3 pt-0 text-sm">
					<div className="flex min-h-7 items-center gap-2 text-muted-foreground">
						<MessageSquare className="size-4 shrink-0" aria-hidden />
						<span className="flex-1">Responses</span>
						<span className="tabular-nums text-foreground">{responses.length}</span>
					</div>
					{latest?.outputTokens !== undefined && <div className="flex min-h-7 items-center gap-2 text-muted-foreground"><Hash className="size-4 shrink-0" aria-hidden /><span className="flex-1">Output tokens</span><span className="tabular-nums text-foreground">{latest.outputTokens.toLocaleString()}</span></div>}
					<div className="flex min-h-7 items-center gap-2 text-muted-foreground">
						<Gauge className="size-4 shrink-0" aria-hidden />
						<span className="flex-1">Context</span>
						<Usage className="h-7 rounded-md px-0 text-xs tabular-nums text-foreground" providerId={context?.providerId ?? ''} modelId={context?.modelId ?? ''} contextWindow={context?.contextWindow} messages={messages} draft="" hasAttachments={false} />
					</div>
				</CardContent>
				<Collapsible>
					<CollapsibleTrigger render={<Button variant="ghost" className="group h-8 w-full justify-start gap-2 rounded-none px-3 font-medium aria-expanded:bg-transparent" />}>
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
				<Collapsible>
					<CollapsibleTrigger render={<Button variant="ghost" className="group h-8 w-full justify-start gap-2 rounded-none px-3 font-medium aria-expanded:bg-transparent" />}>
						<FileCode className="size-4 text-muted-foreground" aria-hidden />
						<span className="flex-1 text-left">Created scripts</span>
						<span className="text-xs tabular-nums text-muted-foreground">{scripts.length}</span>
						<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="space-y-0.5 px-1 pb-2">
							{scripts.length ? scripts.map((script) => <Button key={`${script.messageId}:${script.id}`} variant="ghost" className="h-9 w-full justify-start gap-2 px-2 font-normal" title={`Show in conversation: ${script.label}`} onClick={() => onJump(script.messageId, script.id)}>
								<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/40"><FileCode className="size-3.5 text-muted-foreground" aria-hidden /></span>
								<span className="min-w-0 flex-1 truncate text-left text-xs">{script.label}</span>
								<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
							</Button>) : <p className="px-2 pb-1 text-xs text-muted-foreground">No created scripts yet.</p>}
						</div>
					</CollapsibleContent>
				</Collapsible>
				<ChatLibrary refreshKey={`${latest?.id}:${latest?.completedAtMs}:${assets.map((asset) => asset.path).join('\n')}`} onAttach={onAttach} />
				<ChatWorkspace onAttach={onWorkspaceAttach} />
			</Card>
		</aside>
	);
}
