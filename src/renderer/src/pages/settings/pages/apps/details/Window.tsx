import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
	APP_WINDOW_DEFAULTS,
	type AppWindowSettings,
	type ResolvedAppWindowSettings,
} from '../../../../../../../shared/app_window_settings';
import { isAppWindowSettings } from '../../../../../../../shared/app_window_validate';
import {
	SettingsAutoDismiss,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../../components';

const DIMENSIONS = ['width', 'height', 'minWidth', 'minHeight'] as const;
const TOGGLES = ['resizable', 'maximizable'] as const;
const WINDOW_KEYS = [...DIMENSIONS, ...TOGGLES] as const;
type Draft = Omit<ResolvedAppWindowSettings, (typeof DIMENSIONS)[number]> &
	Record<(typeof DIMENSIONS)[number], number | string>;

export default function WindowSettings({ appId }: { readonly appId: string }): React.JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<Draft | null>(null);
	const [saved, setSaved] = useState<ResolvedAppWindowSettings | null>(null);
	const [customValues, setCustomValues] = useState(false);
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
				setCustomValues(WINDOW_KEYS.some((key) => settings[key] !== APP_WINDOW_DEFAULTS[key]));
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

	const settings = useMemo<ResolvedAppWindowSettings | null>(
		() =>
			draft
				? {
						...draft,
						width: Number(draft.width),
						height: Number(draft.height),
						minWidth: Number(draft.minWidth),
						minHeight: Number(draft.minHeight),
					}
				: null,
		[draft]
	);
	const valid = settings !== null && isAppWindowSettings(settings);
	const dirty =
		settings !== null && saved !== null && WINDOW_KEYS.some((key) => settings[key] !== saved[key]);

	const persist = useCallback(
		async (nextSettings: AppWindowSettings): Promise<void> => {
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
		},
		[appId]
	);

	useEffect(() => {
		if (
			!customValues ||
			!settings ||
			!valid ||
			!dirty ||
			loading ||
			saving ||
			error === 'saveError'
		)
			return;
		const timeout = window.setTimeout(() => void persist(settings), 300);
		return () => window.clearTimeout(timeout);
	}, [customValues, dirty, error, loading, persist, saving, settings, valid]);

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
								<SettingsRow
									title={t('settings.apps.window.values')}
									description={t(
										`settings.apps.window.${customValues ? 'customDescription' : 'defaultDescription'}`
									)}
									actions={
										<Select
											value={customValues ? 'custom' : 'default'}
											onValueChange={(value) => {
												setError('');
												setStatus('');
												if (value === 'default') {
													setCustomValues(false);
													void persist({});
													return;
												}
												setCustomValues(true);
												setDraft((current) => current ?? { ...APP_WINDOW_DEFAULTS });
											}}
										>
											<SelectTrigger size="sm" aria-label={t('settings.apps.window.values')}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="default">{t('settings.apps.window.default')}</SelectItem>
												<SelectItem value="custom">{t('settings.apps.window.custom')}</SelectItem>
											</SelectContent>
										</Select>
									}
								/>
								{customValues &&
									DIMENSIONS.map((key) => (
										<SettingsRow
											key={key}
											title={t(`settings.apps.window.${key}`)}
											actions={
												<Input
													type="number"
													min={1}
													max={32768}
													step={1}
													required
													className="h-8 text-xs"
													value={draft[key]}
													aria-invalid={!valid}
													aria-label={t(`settings.apps.window.${key}`)}
													onChange={(event) => {
														setDraft(
															(current) => current && { ...current, [key]: event.target.value }
														);
														setError('');
														setStatus('');
													}}
												/>
											}
										/>
									))}
								{customValues &&
									TOGGLES.map((key) => (
										<SettingsRow
											key={key}
											title={t(`settings.apps.window.${key}`)}
											actions={
												<Switch
													checked={draft[key]}
													disabled={saving}
													aria-label={t(`settings.apps.window.${key}`)}
													onCheckedChange={(checked) => {
														setDraft((current) => current && { ...current, [key]: checked });
														setError('');
														setStatus('');
													}}
												/>
											}
										/>
									))}
							</SettingsPanel>
						</fieldset>
						{customValues && !valid && (
							<p role="alert" className="text-xs text-destructive">
								{t('settings.apps.window.invalid')}
							</p>
						)}
						<div className="flex min-h-4 items-center">
							{saving ? (
								<p role="status" className="text-xs text-muted-foreground">
									{t('settings.apps.window.saving')}
								</p>
							) : status ? (
								<SettingsAutoDismiss>
									<p role="status" className="text-xs text-muted-foreground">
										{t(`settings.apps.window.${status}`)}
									</p>
								</SettingsAutoDismiss>
							) : null}
						</div>
					</div>
				)
			)}
		</SettingsSection>
	);
}
