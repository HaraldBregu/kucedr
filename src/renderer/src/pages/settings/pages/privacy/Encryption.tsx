import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VaultState } from '@shared/vault';
import { Switch } from '@/components/ui/switch';
import { SettingsLoadingRows, SettingsNotice, SettingsPanel, SettingsRow } from '../../components';

export function Encryption(): React.JSX.Element {
	const { t } = useTranslation();
	const [state, setState] = useState<VaultState | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void window.app.getVault().then(
			(initial) => {
				if (active) setState(initial);
			},
			() => {
				if (active) setError(t('settings.privacy.encryption.loadFailed'));
			}
		);
		return () => {
			active = false;
		};
	}, [t]);

	const update = async (enabled: boolean): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			setState(await window.app.setVault(enabled));
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : t('settings.privacy.encryption.saveFailed')
			);
			void window.app.getVault().then(setState, () => undefined);
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			{(state || !error) && (
				<SettingsPanel>
					{state ? (
						<SettingsRow
							title={t('settings.privacy.encryption.title')}
							description={
								state.available
									? t('settings.privacy.encryption.description')
									: t('settings.privacy.encryption.unavailable')
							}
							actions={
								<Switch
									aria-label={t('settings.privacy.encryption.title')}
									checked={state.enabled}
									disabled={busy || !state.available}
									onCheckedChange={(enabled) => void update(enabled)}
								/>
							}
						/>
					) : (
						<SettingsLoadingRows rows={1} />
					)}
				</SettingsPanel>
			)}
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
		</>
	);
}
