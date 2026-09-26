import { useState } from 'react';
import type { CodingResponseEvent } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Interaction({
	request,
	onRespond,
}: {
	request: Extract<CodingResponseEvent, { type: 'interaction' }>;
	onRespond: (id: string, approved: boolean, answers?: Record<string, string>) => Promise<void>;
}) {
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	return (
		<form
			className="my-4 space-y-3 rounded-lg border p-3"
			onSubmit={(event) => {
				event.preventDefault();
				setSaving(true);
				void onRespond(request.requestId, true, answers).finally(() => setSaving(false));
			}}
		>
			<h3 className="text-sm font-medium">
				{request.kind === 'input' ? 'Your input is needed' : 'Approval needed'} · {request.toolName}
			</h3>
			<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
				{JSON.stringify(request.input, null, 2)}
			</pre>
			{request.questions?.map((question) => (
				<label key={question.id} className="block space-y-2 text-sm">
					<span>{question.question}</span>
					{question.options?.length ? (
						<div className="flex flex-wrap gap-2">
							{question.options.map((option) => (
								<Button
									type="button"
									key={option}
									size="sm"
									variant={answers[question.id] === option ? 'secondary' : 'outline'}
									disabled={saving}
									onClick={() =>
										setAnswers((current) => ({
											...current,
											[question.id]: option,
										}))
									}
								>
									{option}
								</Button>
							))}
						</div>
					) : null}
					<Input
						aria-label={question.question}
						required
						disabled={saving}
						value={answers[question.id] ?? ''}
						onChange={(event) =>
							setAnswers((current) => ({
								...current,
								[question.id]: event.target.value,
							}))
						}
					/>
				</label>
			))}
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={saving}
					onClick={() => {
						setSaving(true);
						void onRespond(request.requestId, false).finally(() => setSaving(false));
					}}
				>
					Deny
				</Button>
				<Button type="submit" size="sm" disabled={saving}>
					{request.kind === 'input' ? 'Submit' : 'Allow'}
				</Button>
			</div>
		</form>
	);
}
