import { useRef, useState, type ReactElement } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentToolPart, PendingUserInput } from '../context';

export function McpAuthorizationCard({
	tool,
	pending,
}: {
	readonly tool: AgentToolPart;
	readonly pending?: PendingUserInput;
}): ReactElement | null {
	const [connecting, setConnecting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cancelled = useRef(false);
	let output = tool.output;
	if (typeof output === 'string') {
		try {
			output = JSON.parse(output);
		} catch {
			output = undefined;
		}
	}
	const result = output && typeof output === 'object' && !Array.isArray(output)
		? (output as { status?: unknown; serverId?: unknown; serverName?: unknown })
		: undefined;
	const input = tool.input as { serverId?: unknown } | undefined;
	const serverId = typeof input?.serverId === 'string' ? input.serverId
		: typeof result?.serverId === 'string' ? result.serverId : undefined;
	if (!serverId || (!pending && result?.status !== 'authorized' && result?.status !== 'cancelled' && result?.status !== 'authorization_failed')) return null;
	const serverName = typeof result?.serverName === 'string' ? result.serverName : serverId;
	const authorized = result?.status === 'authorized';
	const stopped = result?.status === 'cancelled';
	const failed = result?.status === 'authorization_failed';

	const respond = async (answer: string): Promise<boolean> => {
		if (!pending) return false;
		const accepted = await window.agent.respondUserInput(pending, [{ questionId: 'mcp-authorization', answer }]);
		if (!accepted) setError('This authorization request is no longer active.');
		return accepted;
	};

	const authorize = async (): Promise<void> => {
		setError(null);
		setConnecting(true);
		try {
			await window.mcp.oauthStart(serverId);
			if (!cancelled.current) await respond('authorized');
		} catch (cause) {
			if (!cancelled.current) setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setConnecting(false);
		}
	};

	const cancel = async (): Promise<void> => {
		cancelled.current = true;
		setError(null);
		try {
			await respond('cancel');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	};

	return (
		<Card className="max-w-2xl gap-3 border-border/70 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">
					{authorized ? `${serverName} authorized` : stopped ? 'Authorization cancelled' : failed ? 'Authorization failed' : `Authorize ${serverName}`}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 px-4 text-sm">
				{authorized ? (
					<div role="status" className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
						<Check className="size-4" /> Authorized
					</div>
				) : stopped ? (
					<p className="text-muted-foreground">The request was cancelled.</p>
				) : failed ? (
					<p className="text-muted-foreground">No authorization was saved. Please try again.</p>
				) : (
					<>
						<p className="text-muted-foreground">Authorize {serverName} to continue this request.</p>
						<div className="flex gap-2">
							<Button type="button" variant="outline" size="sm" disabled={connecting || cancelled.current} onClick={() => void authorize()}>
								<KeyRound className="size-3.5" /> {connecting ? 'Connecting' : 'Authorize'}
							</Button>
							<Button type="button" variant="ghost" size="sm" disabled={cancelled.current} onClick={() => void cancel()}>Cancel</Button>
						</div>
					</>
				)}
				{error && <p role="alert" className="text-destructive">{error}</p>}
			</CardContent>
		</Card>
	);
}
