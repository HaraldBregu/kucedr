import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CoderInteractionResponse, CodingResponseEvent } from '@shared/coding_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SessionInteraction({ interaction, onRespond }: { readonly interaction: Extract<CodingResponseEvent, { type: 'interaction' }>; readonly onRespond: (response: CoderInteractionResponse) => Promise<void> }): React.JSX.Element {
	const { t } = useTranslation();
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	return (
		<form className="space-y-2 rounded-md border p-3" onSubmit={(event) => { event.preventDefault(); setBusy(true); void onRespond({ approved: true, answers }).finally(() => setBusy(false)); }}>
			<p className="font-medium">{interaction.toolName}</p>
			<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-muted-foreground">{JSON.stringify(interaction.input, null, 2)}</pre>
			{interaction.questions?.map((question) => <label key={question.id} className="grid gap-1">{question.question}{question.options ? <select required className="h-8 rounded-md border bg-background px-2" value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}><option value="">{t('codeSessions.selectAnswer', 'Select an answer')}</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <Input required value={answers[question.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />}</label>)}
			<div className="flex gap-2"><Button type="submit" size="xs" disabled={busy}>{interaction.kind === 'input' ? t('codeSessions.answer', 'Submit answer') : t('codeSessions.approve', 'Approve')}</Button><Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => { setBusy(true); void onRespond({ approved: false }).finally(() => setBusy(false)); }}>{t('codeSessions.deny', 'Deny')}</Button></div>
		</form>
	);
}
