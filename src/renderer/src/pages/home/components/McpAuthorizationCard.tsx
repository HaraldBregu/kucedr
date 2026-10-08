import { useRef, useState, type ReactElement } from 'react';
import { KeyRound } from 'lucide-react';
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
	const [cancelling, setCancelling] = useState(false);
	const [submittedAuthorization, setSubmittedAuthorization] = useState(false);
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
	const result =
		output && typeof output === 'object' && !Array.isArray(output)
			? (output as { status?: unknown; serverId?: unknown; serverName?: unknown })
			: undefined;
	const input = tool.input as { serverId?: unknown } | undefined;
	const serverId =
		typeof input?.serverId === 'string'
			? input.serverId
			: typeof result?.serverId === 'string'
				? result.serverId
				: undefined;
	if (
		!serverId ||
		(submittedAuthorization && result?.status !== 'authorization_failed') ||
		result?.status === 'authorized' ||
		result?.status === 'already_authorized' ||
		(!pending &&
			result?.status !== 'cancelled' &&
			result?.status !== 'authorization_failed')
	)
		return null;
	const serverName = typeof result?.serverName === 'string' ? result.serverName : serverId;
	const stopped = result?.status === 'cancelled';
	const failed = result?.status === 'authorization_failed';

	const respond = async (answer: string): Promise<boolean> => {
		if (!pending) return false;
		const accepted = await window.agent.respondUserInput(pending, [
			{ questionId: 'mcp-authorization', answer },
		]);
		if (!accepted) setError('This authorization request is no longer active.');
		return accepted;
	};

	const authorize = async (): Promise<void> => {
		setError(null);
		setConnecting(true);
		try {
			await window.mcp.oauthStart(serverId);
			if (!cancelled.current && (await respond('authorized'))) setSubmittedAuthorization(true);
		} catch (cause) {
			if (!cancelled.current) setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setConnecting(false);
		}
	};

	const cancel = async (): Promise<void> => {
		cancelled.current = true;
		setCancelling(true);
		setError(null);
		try {
			if (!(await respond('cancel'))) {
				cancelled.current = false;
				setCancelling(false);
			}
		} catch (cause) {
			cancelled.current = false;
			setCancelling(false);
			setError(cause instanceof Error ? cause.message : String(cause));
		}
	};

	return (
		<Card className="max-w-2xl gap-3 border-border/70 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">
					{stopped
						? 'Authorization cancelled'
							: failed
								? 'Authorization failed'
								: `Authorize ${serverName}`}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3 px-4 text-sm">
				{stopped ? (
					<p className="text-muted-foreground">The request was cancelled.</p>
				) : failed ? (
					<p className="text-muted-foreground">No authorization was saved. Please try again.</p>
				) : (
					<>
						<p className="text-muted-foreground">
							Authorize {serverName} to continue this request.
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={connecting || cancelling}
								onClick={() => void authorize()}
							>
								<KeyRound className="size-3.5" /> {connecting ? 'Connecting' : 'Authorize'}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={cancelling}
								onClick={() => void cancel()}
							>
								Cancel
							</Button>
						</div>
					</>
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
