import { Activity, ArrowUpRight, ChevronDown, File, Files, MessageSquare, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { HomeChatMessage } from './context/state';
import { chatAssets } from './components/assets';
import { statusLabel } from './components/status';
import { ToolActivityGroup } from './components/ToolActivityGroup';

export function ChatDetails({ messages, onJump }: {
	readonly messages: readonly HomeChatMessage[];
	readonly onJump: (messageId: string) => void;
}): React.JSX.Element {
	const responses = messages.filter((message) => message.role === 'agent');
	const latest = responses.at(-1);
	const tools = responses.flatMap((message) => message.tools);
	const assets = chatAssets(responses);
	return (
		<aside aria-label="Chat information" className="absolute bottom-6 right-4 top-6 hidden w-72 overflow-y-auto @[1120px]/chat:block">
			<Card size="sm" className="gap-0 rounded-2xl border border-border bg-card ring-0">
				<CardHeader className="pb-3">
					<CardTitle>Chat information</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 pb-3 text-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						<MessageSquare className="size-4 shrink-0" aria-hidden />
						<span className="flex-1">Responses</span>
						<span className="tabular-nums text-foreground">{responses.length}</span>
					</div>
					{latest && <div className="flex items-start gap-2 text-muted-foreground">
						<Activity className="mt-0.5 size-4 shrink-0" aria-hidden />
						<div className="min-w-0"><p className="text-xs">Latest response</p><p className="mt-0.5 text-foreground" role="status">{statusLabel(latest)}</p></div>
					</div>}
					{latest?.outputTokens !== undefined && <div className="flex justify-between gap-2 text-muted-foreground"><span>Output tokens</span><span className="tabular-nums text-foreground">{latest.outputTokens.toLocaleString()}</span></div>}
				</CardContent>
				<Collapsible className="border-t border-border">
					<CollapsibleTrigger render={<Button variant="ghost" className="group h-11 w-full justify-start rounded-none px-3 font-normal" />}>
						<Wrench className="size-4 text-muted-foreground" aria-hidden />
						<span className="flex-1 text-left">Tool calls</span>
						<span className="text-xs tabular-nums text-muted-foreground">{tools.length}</span>
						<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="px-3 pb-3">{tools.length ? <ToolActivityGroup tools={tools} /> : <p className="text-xs text-muted-foreground">No tool calls yet.</p>}</div>
					</CollapsibleContent>
				</Collapsible>
				<Collapsible defaultOpen className="border-t border-border">
					<CollapsibleTrigger render={<Button variant="ghost" className="group h-11 w-full justify-start rounded-none px-3 font-normal" />}>
						<Files className="size-4 text-muted-foreground" aria-hidden />
						<span className="flex-1 text-left">Generated assets</span>
						<span className="text-xs tabular-nums text-muted-foreground">{assets.length}</span>
						<ChevronDown className="size-4 text-muted-foreground transition-transform group-data-open:rotate-180" aria-hidden />
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="px-2 pb-2">
							{assets.length ? assets.map(({ path, messageId }) => <Button key={path} variant="ghost" className="h-auto min-h-9 w-full justify-start px-2 py-2 font-normal" title={`Show in conversation: ${path}`} onClick={() => onJump(messageId)}>
								<File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
								<span className="min-w-0 flex-1 truncate text-left text-xs">{path.replace(/\\/g, '/').split('/').at(-1)}</span>
								<ArrowUpRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
							</Button>) : <p className="px-1 pb-1 text-xs text-muted-foreground">No generated assets yet.</p>}
						</div>
					</CollapsibleContent>
				</Collapsible>
			</Card>
		</aside>
	);
}
