import React, { useEffect, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Phase = 'idle' | 'busy' | 'done';

export function McpOAuthButton({
	id,
	beforeStart,
}: {
	readonly id: string;
	readonly beforeStart?: () => Promise<void>;
}): React.JSX.Element {
	const [phase, setPhase] = useState<Phase>('idle');
	const [error, setError] = useState<string | null>(null);
	const [authenticated, setAuthenticated] = useState<boolean | null>(null);

	useEffect(() => {
		let cancelled = false;
		void window.mcp.oauthStatus(id).then(
			(value) => {
				if (!cancelled) setAuthenticated(value);
			},
			() => {
				if (!cancelled) setAuthenticated(false);
			}
		);
		return () => {
			cancelled = true;
		};
	}, [id]);

	const start = async (): Promise<void> => {
		setError(null);
		setPhase('busy');
		try {
			await beforeStart?.();
			await window.mcp.oauthStart(id);
			setAuthenticated(true);
			setPhase('done');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setPhase('idle');
		}
	};

	if (phase === 'done' || authenticated) {
		return (
			<div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
				<Check className="size-3.5 text-emerald-500" />
				Authenticated
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => {
						setAuthenticated(false);
						setPhase('idle');
					}}
				>
					Re-authenticate
				</Button>
			</div>
		);
	}

	return (
		<div className="grid gap-2">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={phase === 'busy' || authenticated === null}
				onClick={start}
			>
				<KeyRound className="size-3.5" />
				{phase === 'busy'
					? 'Connecting'
					: authenticated === null
						? 'Checking authentication'
						: 'Connect with OAuth'}
			</Button>
			{error && <p className="text-[13px] text-destructive">{error}</p>}
		</div>
	);
}
