import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentRunBudget } from '@shared/agent_types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../components';

const units = ['turns', 'tokens'] as const;

export function Budgets(): React.JSX.Element {
	const { t } = useTranslation();
	const [saved, setSaved] = useState<AgentRunBudget>();
	const [draft, setDraft] = useState({ turns: '', tokens: '' });
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	useEffect(() => {
		let active = true;
		void window.agent.getRunBudget().then(
			(value) => {
				if (!active) return;
				setSaved(value);
				setDraft({ turns: value.turns?.toString() ?? '', tokens: value.tokens?.toString() ?? '' });
			},
			() => {
				if (active) setError('loadError');
			}
		);
		return () => {
			active = false;
		};
	}, []);

	const dirty = units.some((unit) => draft[unit] !== (saved?.[unit]?.toString() ?? ''));
	const submit = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		setSaving(true);
		setError('');
		try {
			const next = await window.agent.setRunBudget({
				...(draft.turns && { turns: Number(draft.turns) }),
				...(draft.tokens && { tokens: Number(draft.tokens) }),
			});
			setSaved(next);
			setDraft({ turns: next.turns?.toString() ?? '', tokens: next.tokens?.toString() ?? '' });
		} catch {
			setError('saveError');
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={submit}>
			<SettingsSection
				title={t('settings.runBudget.title')}
				description={t('settings.runBudget.description')}
				action={
					<Button type="submit" size="sm" variant="outline" disabled={!saved || saving || !dirty}>
						{t('settings.runBudget.save')}
					</Button>
				}
			>
				{error && (
					<SettingsNotice variant="destructive">{t(`settings.runBudget.${error}`)}</SettingsNotice>
				)}
				<SettingsPanel>
					{units.map((unit) => (
						<SettingsRow
							key={unit}
							title={t(`settings.runBudget.${unit}`)}
							actions={
								<Input
									type="number"
									min={1}
									step={1}
									max={Number.MAX_SAFE_INTEGER}
									className="w-32"
									aria-label={t(`settings.runBudget.${unit}`)}
									placeholder={t('settings.runBudget.unlimited')}
									value={draft[unit]}
									disabled={!saved || saving}
									onChange={(event) => setDraft({ ...draft, [unit]: event.target.value })}
								/>
							}
						/>
					))}
				</SettingsPanel>
			</SettingsSection>
		</form>
	);
}
