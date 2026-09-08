import React, { useState } from 'react';
import { Pencil, PlugZap } from 'lucide-react';
import type { McpData } from '@shared/mcp_types';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { McpServerForm } from './McpServerForm';

export function CustomMcpCard({
	id,
	entry,
	onSave,
	onRemove,
	icon,
}: {
	readonly id: string;
	readonly entry: McpData;
	readonly onSave: (id: string, entry: McpData) => Promise<void>;
	readonly onRemove?: (id: string) => Promise<void>;
	readonly icon?: React.ReactNode;
}): React.JSX.Element {
	const [expanded, setExpanded] = useState(false);
	const [editing, setEditing] = useState(false);
	const description = entry.type === 'http' ? entry.url : entry.command;

	const remove = async (): Promise<void> => {
		if (!onRemove) return;
		await onRemove(id);
	};

	return (
		<Card size="sm" className="py-4!">
			<Collapsible open={expanded} onOpenChange={setExpanded}>
				<CardHeader className={cn('items-center px-4!', expanded && 'border-b pb-4!')}>
					<div className="flex min-w-0 flex-1 items-center gap-2.5">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
							{icon ?? <PlugZap className="size-4 text-muted-foreground" />}
						</div>
						<div className="min-w-0">
							<CardTitle className="truncate">{entry.name ?? id}</CardTitle>
							<p className="truncate font-mono text-xs text-muted-foreground">{description}</p>
						</div>
					</div>
					<CardAction className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`Edit ${entry.name ?? id}`}
							onClick={() => {
								setExpanded(true);
								setEditing(true);
							}}
						>
							<Pencil className="size-3" />
						</Button>
					</CardAction>
				</CardHeader>
				<CollapsibleContent>
					<CardContent className="px-4! pt-5">
						{editing ? (
							<McpServerForm
								initial={{ id, entry }}
								onSubmit={async (nextId, nextEntry) => {
									await onSave(nextId, nextEntry);
									setEditing(false);
									setExpanded(false);
								}}
								onCancel={() => {
									setEditing(false);
									setExpanded(false);
								}}
								onRemove={onRemove ? remove : undefined}
							/>
						) : (
							<p className="text-sm text-muted-foreground">
								{entry.type === 'http' ? 'Remote HTTP server' : 'Local command server'}
							</p>
						)}
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}
