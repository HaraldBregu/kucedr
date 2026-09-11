import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
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

	const settings = useMemo(
		() =>
			draft && {
				...draft,
				width: Number(draft.width),
				height: Number(draft.height),
				minWidth: Number(draft.minWidth),
				minHeight: Number(draft.minHeight),
			},
		[draft]
	);
	const valid = settings !== null && isAppWindowSettings(settings);
	const dirty =
		settings !== null &&
		saved !== null &&
		[...DIMENSIONS, ...TOGGLES].some((key) => settings[key] !== saved[key]);

	const persist = useCallback(async (nextSettings: ResolvedAppWindowSettings): Promise<void> => {
		setSaving(true);
		setError('');
		setStatus('');
		try {
			const result = await window.apps.setSettings(appId, nextSettings);
			setSaved(result);
			setDraft(result);
			setStatus('saved');
		} catch {
			setError('saveError');
		} finally {
			setSaving(false);
		}
	}, [appId]);

	useEffect(() => {
		if (!settings || !valid || !dirty || loading || saving || error === 'saveError') return;
		const timeout = window.setTimeout(() => void persist(settings), 300);
		return () => window.clearTimeout(timeout);
	}, [dirty, error, loading, persist, saving, settings, valid]);

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
					<div className="grid min-w-0 gap-2">
						<fieldset disabled={saving}>
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
															setError('');
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
															setError('');
															setStatus('');
												}}
											/>
										}
									/>
								))}
							</SettingsPanel>
						</fieldset>
							{!valid && (
								<p id={`${id}-validation`} role="alert" className="text-xs text-destructive">
									{t('settings.apps.window.invalid')}
								</p>
							)}
							<div className="flex min-h-4 items-center">
								<p role="status" className="text-xs text-muted-foreground">
									{(saving || status) && t(`settings.apps.window.${saving ? 'saving' : status}`)}
								</p>
							</div>
					</div>
				)
			)}
		</SettingsSection>
	);
}
