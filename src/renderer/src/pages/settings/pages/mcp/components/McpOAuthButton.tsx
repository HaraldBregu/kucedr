import React, { useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Phase = 'idle' | 'awaitingCode' | 'busy' | 'done';

function extractCode(input: string): string {
	const value = input.trim();
	try {
		return new URL(value).searchParams.get('code') ?? value;
	} catch {
		return value;
	}
}

export function McpOAuthButton({
	id,
	beforeStart,
}: {
	readonly id: string;
	readonly beforeStart?: () => Promise<void>;
}): React.JSX.Element {
	const [phase, setPhase] = useState<Phase>('idle');
	const [callback, setCallback] = useState('');
	const [error, setError] = useState<string | null>(null);

	const start = async (): Promise<void> => {
		setError(null);
		setPhase('busy');
		try {
			await beforeStart?.();
			const result = await window.mcp.oauthStart(id);
			if (result.status === 'authorized') {
				setPhase('done');
				return;
			}
			await window.app.openExternalUrl(result.url);
			setPhase('awaitingCode');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setPhase('idle');
		}
	};

	const complete = async (): Promise<void> => {
		const code = extractCode(callback);
		if (!code) {
			setError('Paste the authorization code or redirect URL.');
			return;
		}
		setError(null);
		setPhase('busy');
		try {
			await window.mcp.oauthFinish(id, code);
			setPhase('done');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setPhase('awaitingCode');
		}
	};

	if (phase === 'done') {
		return (
			<div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
				<Check className="size-3.5 text-emerald-500" />
				Authenticated
				<Button type="button" variant="ghost" size="sm" onClick={() => setPhase('idle')}>
					Re-authenticate
				</Button>
			</div>
		);
	}

	return (
		<div className="grid gap-2">
			{phase === 'awaitingCode' ? (
				<>
					<p className="text-[13px] text-muted-foreground">
						Approve access in your browser, then paste the redirected URL (or the code) below.
					</p>
					<div className="flex gap-2">
						<Input
							value={callback}
							onChange={(e) => setCallback(e.target.value)}
							placeholder="http://127.0.0.1:8989/oauth/callback?code=…"
							autoComplete="off"
						/>
						<Button type="button" onClick={complete}>
							Complete
						</Button>
					</div>
				</>
			) : (
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={phase === 'busy'}
					onClick={start}
				>
					<KeyRound className="size-3.5" />
					{phase === 'busy' ? 'Connecting' : 'Connect with OAuth'}
				</Button>
			)}
			{error && <p className="text-[13px] text-destructive">{error}</p>}
		</div>
	);
}
