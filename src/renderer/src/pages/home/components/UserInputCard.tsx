import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentUserInputAnswer, AgentUserInputQuestion } from '@/lib/compat';
import type { AgentToolPart, PendingUserInput } from '../context';

function resultFromTool(tool: AgentToolPart): {
	status: 'resolved' | 'interrupted';
	answers: AgentUserInputAnswer[];
} | undefined {
	let value = tool.output;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const result = value as { status?: unknown; answers?: unknown };
	if (result.status !== 'resolved' && result.status !== 'interrupted') return undefined;
	return {
		status: result.status,
		answers: Array.isArray(result.answers) ? (result.answers as AgentUserInputAnswer[]) : [],
	};
}

export function UserInputCard({
	tool,
	pending,
}: {
	readonly tool: AgentToolPart;
	readonly pending?: PendingUserInput;
}): ReactElement | null {
	const questions = (pending?.questions ??
		(tool.input as { questions?: AgentUserInputQuestion[] } | undefined)?.questions ??
		[]) as AgentUserInputQuestion[];
	const result = useMemo(() => resultFromTool(tool), [tool]);
	const [selected, setSelected] = useState<Record<string, string>>({});
	const [other, setOther] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const resolvedRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (result) resolvedRef.current?.focus();
	}, [result]);
	if (questions.length === 0) return null;

	if (result) {
		return (
			<Card className="max-w-2xl gap-3 border-border/70 py-4">
				<CardHeader className="px-4">
					<div ref={resolvedRef} tabIndex={-1} className="outline-none">
						<CardTitle className="text-sm">
							{result.status === 'resolved' ? 'Planning choices' : 'Questions interrupted'}
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-2 px-4 text-sm">
					{questions.map((question) => {
						const answer = result.answers.find((candidate) => candidate.questionId === question.id);
						return (
						<div key={question.id}>
							<span className="block font-medium">{question.question}</span>
							<span className="text-muted-foreground">
								{answer?.answer ?? 'Interrupted before an answer was submitted.'}
							</span>
						</div>
						);
					})}
				</CardContent>
			</Card>
		);
	}

	if (!pending) return null;

	const submit = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		const answers = questions.map((question) => ({
			questionId: question.id,
			answer: selected[question.id] === '__other__'
				? (other[question.id] ?? '').trim()
				: (selected[question.id] ?? '').trim(),
		}));
		if (answers.some((answer) => !answer.answer)) {
			setError('Choose an answer for every question and complete any selected Other field.');
			return;
		}
		setSubmitting(true);
		setError('');
		try {
			const accepted = await window.agent.respondUserInput(pending, answers);
			if (!accepted) setError('These questions are no longer active. Stop and retry the plan.');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not submit these answers.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="max-w-2xl gap-4 border-info/30 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">A few choices before I finish the plan</CardTitle>
			</CardHeader>
			<form onSubmit={(event) => void submit(event)}>
				<CardContent className="space-y-5 px-4">
					{questions.map((question) => (
						<fieldset key={question.id} className="space-y-2">
							<legend className="text-sm font-medium">
								<span className="mr-2 text-xs text-muted-foreground">{question.header}</span>
								{question.question}
							</legend>
							{[...question.options, { label: 'Other', description: 'Enter a different answer.' }].map(
								(option) => {
									const value = option.label === 'Other' ? '__other__' : option.label;
									return (
										<label
											key={value}
											className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
										>
											<input
												type="radio"
												name={question.id}
												value={value}
												checked={selected[question.id] === value}
												disabled={submitting}
												onChange={() => setSelected((current) => ({ ...current, [question.id]: value }))}
												className="mt-1"
											/>
											<span>
												<span className="block font-medium">{option.label}</span>
												<span className="block text-xs text-muted-foreground">{option.description}</span>
											</span>
										</label>
									);
								}
							)}
							{selected[question.id] === '__other__' ? (
								<input
									type="text"
									aria-label={`${question.header} other answer`}
									value={other[question.id] ?? ''}
									disabled={submitting}
									onChange={(event) =>
										setOther((current) => ({ ...current, [question.id]: event.target.value }))
									}
									className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
								/>
							) : null}
						</fieldset>
					))}
					<p aria-live="polite" className="text-sm text-destructive">{error}</p>
				</CardContent>
				<CardFooter className="justify-end px-4 pt-4">
					<Button type="submit" size="sm" disabled={submitting}>
						{submitting ? 'Submitting…' : 'Continue planning'}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
