import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AgentUserInputAnswer, AgentUserInputQuestion } from '@/lib/compat';
import { cn } from '@/lib/utils';
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
	const [step, setStep] = useState(0);
	const [selected, setSelected] = useState<Record<string, string>>({});
	const [other, setOther] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const resolvedRef = useRef<HTMLDivElement>(null);
	const legendRef = useRef<HTMLLegendElement>(null);
	useEffect(() => {
		if (result) resolvedRef.current?.focus();
	}, [result]);
	useEffect(() => {
		if (step > 0) legendRef.current?.focus();
	}, [step]);
	if (questions.length === 0) return null;

	if (result) {
		return (
			<Card className="max-w-2xl gap-3 border-border/70 py-4">
				<CardHeader className="px-4">
					<div ref={resolvedRef} tabIndex={-1} className="outline-none">
						<CardTitle className="text-sm">
							{result.status === 'resolved' ? 'Your choices' : 'Questions interrupted'}
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

	const many = questions.length > 1;
	const last = step === questions.length - 1;
	const question = questions[step];
	const answerFor = (id: string): string =>
		(selected[id] === '__other__' ? (other[id] ?? '') : (selected[id] ?? '')).trim();
	const goTo = (index: number): void => {
		setError('');
		setStep(index);
	};

	const submit = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		if (!answerFor(question.id)) {
			setError('Choose an answer, or complete the Other field.');
			return;
		}
		if (!last) {
			goTo(step + 1);
			return;
		}
		const answers = questions.map((candidate) => ({
			questionId: candidate.id,
			answer: answerFor(candidate.id),
		}));
		setSubmitting(true);
		setError('');
		try {
			const accepted = await window.agent.respondUserInput(pending, answers);
			if (!accepted) setError('These questions are no longer active. Stop and retry.');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not submit these answers.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="max-w-2xl gap-4 border-info/30 py-4">
			<CardHeader className="flex flex-row items-center justify-between gap-3 px-4">
				<CardTitle className="text-sm">
					{many ? 'A few choices before I continue' : 'A choice before I continue'}
				</CardTitle>
				{many ? (
					<ol aria-label="Questions" className="flex flex-wrap items-center justify-end gap-1.5">
						{questions.map((candidate, index) => (
							<li key={candidate.id}>
								<button
									type="button"
									aria-current={index === step ? 'step' : undefined}
									disabled={submitting || index > step}
									onClick={() => goTo(index)}
									className={cn(
										'rounded-full px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-default',
										index === step
											? 'bg-primary text-primary-foreground'
											: index < step
												? 'bg-muted text-foreground hover:bg-muted/70'
												: 'bg-muted/50 text-muted-foreground'
									)}
								>
									{candidate.header}
								</button>
							</li>
						))}
					</ol>
				) : null}
			</CardHeader>
			<form onSubmit={(event) => void submit(event)}>
				<CardContent className="space-y-2 px-4">
					<fieldset key={question.id} className="space-y-2">
						<legend ref={legendRef} tabIndex={-1} className="mb-2 text-sm font-medium outline-none">
							{many ? (
								<span className="mr-2 text-xs text-muted-foreground">
									{step + 1} of {questions.length}
								</span>
							) : (
								<span className="mr-2 text-xs text-muted-foreground">{question.header}</span>
							)}
							{question.question}
						</legend>
						{[...question.options, { label: 'Other', description: 'Enter a different answer.' }].map(
							(option) => {
								const value = option.label === 'Other' ? '__other__' : option.label;
								return (
									<label
										key={value}
										className={cn(
											'flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 p-2 text-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40',
											selected[question.id] === value && 'border-ring bg-muted/40'
										)}
									>
										<input
											type="radio"
											name={question.id}
											value={value}
											checked={selected[question.id] === value}
											disabled={submitting}
											onChange={() => {
												setError('');
												setSelected((current) => ({ ...current, [question.id]: value }));
											}}
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
							<Input
								type="text"
								autoFocus
								aria-label={`${question.header} other answer`}
								value={other[question.id] ?? ''}
								disabled={submitting}
								onChange={(event) =>
									setOther((current) => ({ ...current, [question.id]: event.target.value }))
								}
							/>
						) : null}
					</fieldset>
					<p aria-live="polite" className="text-sm text-destructive">{error}</p>
				</CardContent>
				<CardFooter className="justify-end gap-2 px-4 pt-4">
					{step > 0 ? (
						<Button type="button" variant="ghost" size="sm" disabled={submitting} onClick={() => goTo(step - 1)}>
							Back
						</Button>
					) : null}
					<Button type="submit" size="sm" disabled={submitting}>
						{submitting ? 'Submitting…' : last ? 'Continue' : 'Next'}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
