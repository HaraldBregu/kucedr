import { useEffect, useState, type ReactElement } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentToolPart } from '../context';

export function McpAuthorizationCard({
	tool,
}: {
	readonly tool: AgentToolPart;
}): ReactElement | null {
	const [phase, setPhase] = useState<'idle' | 'connecting' | 'authorized'>('idle');
	const [error, setError] = useState<string | null>(null);
	let output = tool.output;
	if (typeof output === 'string') {
		try {
			output = JSON.parse(output);
		} catch {
			output = undefined;
		}
	}
	const result =
		output && typeof output === 'object' && !Array.isArray(output)
			? (output as { status?: unknown; serverId?: unknown; serverName?: unknown })
			: undefined;
	const serverId = typeof result?.serverId === 'string' ? result.serverId : undefined;
	useEffect(() => {
		if (!serverId) return;
		let cancelled = false;
		void window.mcp
			.oauthStatus(serverId)
			.then(async (hasToken) => {
				if (!hasToken) return;
				const connection = await window.mcp.test(serverId);
				if (!cancelled && connection.ok) setPhase('authorized');
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [serverId]);
	if ((result?.status !== 'authorization_required' && result?.status !== 'connected') || !serverId)
		return null;
	const serverName = typeof result.serverName === 'string' ? result.serverName : result.serverId;
	const authorized = phase === 'authorized';
	const connected = authorized || result.status === 'connected';

	const authorize = async (): Promise<void> => {
		setError(null);
		setPhase('connecting');
		try {
			await window.mcp.oauthStart(serverId);
			setPhase('authorized');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
			setPhase('idle');
		}
	};

	return (
		<Card className="max-w-2xl gap-3 border-border/70 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">
					{authorized
						? `${serverName} authorized`
						: connected
							? `${serverName} connected`
							: `Authorize ${serverName}`}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 px-4 text-sm">
				<p className="text-muted-foreground">
					{connected
						? 'The MCP server is connected. You can continue in chat.'
						: `Connect ${serverName} to use its tools in chat.`}
				</p>
				{connected ? (
					<div
						role="status"
						className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
					>
						<Check className="size-4" /> {authorized ? 'Authorized' : 'Connected'}
					</div>
				) : (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={phase === 'connecting'}
						onClick={() => void authorize()}
					>
						<KeyRound className="size-3.5" />
						{phase === 'connecting' ? 'Connecting' : 'Authorize'}
					</Button>
				)}
				{error && (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
			</CardContent>
		</Card>
	);
}
