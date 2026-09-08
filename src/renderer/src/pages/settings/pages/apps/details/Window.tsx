import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { ResolvedAppWindowSettings } from '../../../../../../../shared/app_window_settings';
import { isAppWindowSettings } from '../../../../../../../shared/app_window_validate';
import {
	SettingsField,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../../components';

const DIMENSIONS = ['width', 'height', 'minWidth', 'minHeight'] as const;
const TOGGLES = ['resizable', 'maximizable'] as const;
type Draft = Omit<ResolvedAppWindowSettings, (typeof DIMENSIONS)[number]> &
	Record<(typeof DIMENSIONS)[number], number | string>;

export default function WindowSettings({ appId }: { readonly appId: string }): React.JSX.Element {
	const { t } = useTranslation();
	const id = useId();
	const [draft, setDraft] = useState<Draft | null>(null);
	const [saved, setSaved] = useState<ResolvedAppWindowSettings | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [status, setStatus] = useState('');
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError('');
		setStatus('');
		void window.apps
			.getSettings(appId)
			.then((settings) => {
				if (!active) return;
				setSaved(settings);
				setDraft(settings);
			})
			.catch(() => {
				if (active) setError('loadError');
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [appId, attempt]);

	const settings = draft && {
		...draft,
		width: Number(draft.width),
		height: Number(draft.height),
		minWidth: Number(draft.minWidth),
		minHeight: Number(draft.minHeight),
	};
	const valid = settings !== null && isAppWindowSettings(settings);
	const dirty =
		settings !== null &&
		saved !== null &&
		[...DIMENSIONS, ...TOGGLES].some((key) => settings[key] !== saved[key]);

	const persist = async (reset: boolean): Promise<void> => {
		if (saving || (!reset && !valid)) return;
		setSaving(true);
		setError('');
		setStatus('');
		try {
			const result = await window.apps.setSettings(appId, reset ? {} : settings!);
			setSaved(result);
			setDraft(result);
			setStatus(reset ? 'resetDone' : 'saved');
		} catch {
			setError('saveError');
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsSection
			title={t('settings.apps.window.title')}
			description={t('settings.apps.window.nextOpen')}
		>
			{error && (
				<SettingsNotice variant="destructive">
					{t(`settings.apps.window.${error}`)}
					{error === 'loadError' && (
						<Button
							variant="outline"
							size="xs"
							className="ml-2"
							onClick={() => setAttempt(attempt + 1)}
						>
							{t('settings.apps.refresh')}
						</Button>
					)}
				</SettingsNotice>
			)}
			{loading ? (
				<SettingsPanel>
					<SettingsLoadingRows rows={3} />
				</SettingsPanel>
			) : (
				draft &&
				error !== 'loadError' && (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void persist(false);
						}}
					>
						<fieldset disabled={saving} className="grid min-w-0 gap-2">
							<SettingsPanel>
								<div className="grid grid-cols-1 gap-3 border-b border-border/60 p-4 sm:grid-cols-2">
									{DIMENSIONS.map((key) => (
										<SettingsField
											key={key}
											id={`${id}-${key}`}
											label={t(`settings.apps.window.${key}`)}
										>
											<Input
												id={`${id}-${key}`}
												type="number"
												min={1}
												max={32768}
												step={1}
												required
												className="h-8 text-xs"
												value={draft[key]}
												aria-invalid={!valid}
												aria-describedby={!valid ? `${id}-validation` : undefined}
												onChange={(event) => {
													setDraft({ ...draft, [key]: event.target.value });
													setStatus('');
												}}
											/>
										</SettingsField>
									))}
								</div>
								{TOGGLES.map((key) => (
									<SettingsRow
										key={key}
										title={t(`settings.apps.window.${key}`)}
										actions={
											<Switch
												checked={draft[key]}
												disabled={saving}
												aria-label={t(`settings.apps.window.${key}`)}
												onCheckedChange={(checked) => {
													setDraft({ ...draft, [key]: checked });
													setStatus('');
												}}
											/>
										}
									/>
								))}
							</SettingsPanel>
							{!valid && (
								<p id={`${id}-validation`} role="alert" className="text-xs text-destructive">
									{t('settings.apps.window.invalid')}
								</p>
							)}
							<div className="flex flex-wrap items-center justify-end gap-2">
								<p role="status" className="mr-auto text-xs text-muted-foreground">
									{status && t(`settings.apps.window.${status}`)}
								</p>
								<Button
									type="button"
									variant="outline"
									size="xs"
									onClick={() => void persist(true)}
								>
									{t('settings.apps.window.reset')}
								</Button>
								<Button type="submit" size="xs" disabled={!valid || !dirty}>
									{t(`settings.apps.window.${saving ? 'saving' : 'save'}`)}
								</Button>
							</div>
						</fieldset>
					</form>
				)
			)}
		</SettingsSection>
	);
}
