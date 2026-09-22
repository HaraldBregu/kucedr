import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentToolPart, PendingUserInput } from '../context';

type Source = { id: string; name: string; type: 'screen' | 'window' };

function sourcesFromTool(tool: AgentToolPart): Source[] {
	const sources = (tool.input as { sources?: unknown } | undefined)?.sources;
	if (!Array.isArray(sources)) return [];
	return sources.filter((source): source is Source =>
		Boolean(
			source &&
			typeof source === 'object' &&
			typeof (source as Source).id === 'string' &&
			typeof (source as Source).name === 'string' &&
			((source as Source).type === 'screen' || (source as Source).type === 'window')
		)
	);
}

function resultFromTool(
	tool: AgentToolPart
): { status: 'resolved' | 'interrupted'; sourceId?: string } | undefined {
	let value = tool.output;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const result = value as { status?: unknown; sourceId?: unknown };
	if (result.status !== 'resolved' && result.status !== 'interrupted') return undefined;
	return {
		status: result.status,
		...(typeof result.sourceId === 'string' ? { sourceId: result.sourceId } : {}),
	};
}

export function ScreenSourceCard({
	tool,
	pending,
}: {
	readonly tool: AgentToolPart;
	readonly pending?: PendingUserInput;
}): ReactElement | null {
	const sources = useMemo(() => sourcesFromTool(tool), [tool]);
	const result = useMemo(() => resultFromTool(tool), [tool]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const resolvedRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (result) resolvedRef.current?.focus();
	}, [result]);
	if (sources.length === 0) return null;

	if (result) {
		const source = sources.find((candidate) => candidate.id === result.sourceId);
		return (
			<Card size="sm" className="max-w-2xl border-border/70">
				<CardContent>
					<div ref={resolvedRef} tabIndex={-1} className="flex items-center justify-between gap-3 outline-none">
						<CardTitle className="min-w-0 truncate text-sm">
							{result.status === 'resolved' ? 'Screen selected' : 'Screen selection interrupted'}
						</CardTitle>
						<span className="max-w-[60%] truncate text-right text-xs text-muted-foreground">
							{source?.name ?? 'No screen source was selected.'}
						</span>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!pending) return null;

	const select = async (sourceId: string): Promise<void> => {
		setSubmitting(true);
		setError('');
		try {
			const accepted = await window.agent.respondUserInput(pending, [
				{ questionId: 'screen-source', answer: sourceId },
			]);
			if (!accepted) setError('This selection is no longer active. Start screen recording again.');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not select this screen source.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="max-w-2xl gap-4 border-info/30 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">Choose a screen to record</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 px-4">
				<ul aria-label="Available screen sources" className="space-y-2">
					{sources.map((source) => (
						<li key={source.id}>
							<Button
								type="button"
								variant="outline"
								disabled={submitting}
								onClick={() => void select(source.id)}
								className="h-auto w-full justify-between gap-3 p-2 text-left text-sm"
							>
								<span className="min-w-0 flex-1 whitespace-normal font-medium">{source.name}</span>
								<span className="shrink-0 text-right text-xs text-muted-foreground">
									{source.type === 'screen' ? 'Display' : 'Window'}
								</span>
							</Button>
						</li>
					))}
				</ul>
				<p aria-live="polite" className="text-sm text-destructive">
					{error}
				</p>
			</CardContent>
		</Card>
	);
}
