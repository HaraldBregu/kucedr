import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentToolPart, PendingUserInput } from '../context';

type Source = { id: string; name: string; type: 'screen' | 'window' };

function sourcesFromTool(tool: AgentToolPart): Source[] {
	const sources = (tool.input as { sources?: unknown } | undefined)?.sources;
	if (!Array.isArray(sources)) return [];
	return sources.filter(
		(source): source is Source =>
			Boolean(
				source &&
				typeof source === 'object' &&
				typeof (source as Source).id === 'string' &&
				typeof (source as Source).name === 'string' &&
				((source as Source).type === 'screen' || (source as Source).type === 'window')
			)
	);
}

function resultFromTool(tool: AgentToolPart): { status: 'resolved' | 'interrupted'; sourceId?: string } | undefined {
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
	const [selected, setSelected] = useState('');
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
			<Card className="max-w-2xl gap-3 border-border/70 py-4">
				<CardHeader className="px-4">
					<div ref={resolvedRef} tabIndex={-1} className="outline-none">
						<CardTitle className="text-sm">
							{result.status === 'resolved' ? 'Screen selected' : 'Screen selection interrupted'}
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="px-4 text-sm text-muted-foreground">
					{source?.name ?? 'No screen source was selected.'}
				</CardContent>
			</Card>
		);
	}

	if (!pending) return null;

	const submit = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		if (!selected) {
			setError('Choose a display or window to record.');
			return;
		}
		setSubmitting(true);
		setError('');
		try {
			const accepted = await window.agent.respondUserInput(pending, [
				{ questionId: 'screen-source', answer: selected },
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
			<form onSubmit={(event) => void submit(event)}>
				<CardContent className="max-h-80 space-y-2 overflow-y-auto px-4">
					{sources.map((source) => (
						<label
							key={source.id}
							className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
						>
							<input
								type="radio"
								name="screen-source"
								value={source.id}
								checked={selected === source.id}
								disabled={submitting}
								onChange={() => setSelected(source.id)}
								className="mt-1"
							/>
							<span>
								<span className="block font-medium">{source.name}</span>
								<span className="block text-xs text-muted-foreground">
									{source.type === 'screen' ? 'Display' : 'Window'}
								</span>
							</span>
						</label>
					))}
					<p aria-live="polite" className="text-sm text-destructive">{error}</p>
				</CardContent>
				<CardFooter className="justify-end px-4 pt-4">
					<Button type="submit" size="sm" disabled={submitting}>
						{submitting ? 'Starting…' : 'Start recording'}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
