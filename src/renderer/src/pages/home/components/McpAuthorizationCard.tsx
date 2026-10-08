import { useRef, useState, type ReactElement } from 'react';
import { KeyRound, LoaderCircle } from 'lucide-react';
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
	const input = tool.input as {
		serverId?: unknown;
		serverName?: unknown;
		force?: unknown;
		toolName?: unknown;
	} | undefined;
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
		(!pending && result?.status !== 'cancelled' && result?.status !== 'authorization_failed')
	)
		return null;
	const serverName =
		typeof input?.serverName === 'string'
			? input.serverName
			: typeof result?.serverName === 'string'
				? result.serverName
				: serverId.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	const toolName = typeof input?.toolName === 'string' ? input.toolName : undefined;
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
			await window.mcp.oauthStart(serverId, input?.force === true);
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
		<Card className="w-full max-w-2xl gap-0 border-border/70 bg-card py-0 shadow-sm">
			<CardHeader className="flex flex-row items-start gap-3 px-4 pt-4 pb-2">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
					<KeyRound className="size-4" aria-hidden="true" />
				</div>
				<div className="min-w-0 space-y-1">
					<CardTitle className="break-words text-sm">
						{stopped
							? 'Authorization cancelled'
							: failed
								? 'Authorization failed'
								: `Authorize ${serverName}`}
					</CardTitle>
					<p className="text-xs text-muted-foreground">
						{stopped
							? 'This request has stopped.'
							: failed
								? 'No authorization was saved.'
								: 'Authentication is required to continue.'}
					</p>
				</div>
			</CardHeader>
			{!stopped && !failed && (
				<CardContent className="space-y-3 px-4 pb-4 pl-16 text-sm">
					<>
						<p className="text-xs text-muted-foreground">
							{toolName
								? `After authorization, ${toolName} will be retried automatically.`
								: 'After authorization, the tool call will be retried automatically.'}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								size="sm"
								disabled={connecting || cancelling}
								onClick={() => void authorize()}
							>
								{connecting && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
								{connecting ? 'Waiting for authorization…' : 'Authorize'}
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
					{error && (
						<p role="alert" className="text-destructive">
							{error}
						</p>
					)}
				</CardContent>
				)}
		</Card>
	);
}
