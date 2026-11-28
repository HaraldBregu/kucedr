import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useOnboarding } from '@/contexts/useOnboarding';
import { usePrivacy } from '@/hooks/privacy';
import {
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';
import { Encryption } from './Encryption';
import { Lock } from './Lock';
import { Storage } from './Storage';
import { Destinations } from './Destinations';

export default function PrivacyPage(): React.JSX.Element {
	const { t } = useTranslation();
	const { phase } = useOnboarding();
	const { state, failed, setState } = usePrivacy();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const update = async (enabled: boolean): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			setState(await window.app.setPrivacy(enabled));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('settings.privacy.saveFailed'));
		} finally {
			setBusy(false);
		}
	};

	const restart = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		try {
			await window.app.restart();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('settings.privacy.restartFailed'));
			setBusy(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.privacy.title')}
				description={t('settings.privacy.description')}
				icon={ShieldCheck}
				iconPosition="top"
			/>
			{state ? (
				<SettingsPanel>
					<SettingsRow
						title={t('settings.privacy.mode')}
						description={t('settings.privacy.modeDescription')}
						actions={
							<Switch
								aria-label={t('settings.privacy.mode')}
								checked={state.enabled}
								disabled={busy}
								onCheckedChange={(enabled) => void update(enabled)}
							/>
						}
					/>
					<SettingsRow
						title={t('settings.privacy.statusTitle')}
						description={t(`settings.privacy.statusDescription.${state.status}`)}
						actions={
							<Badge role="status" variant={state.status === 'blocked' ? 'destructive' : 'secondary'}>
								{t(`settings.privacy.status.${state.status}`)}
							</Badge>
						}
					/>
					<SettingsRow
						title={t('settings.browser.connections.proxy')}
						description={t('settings.privacy.proxyDescription')}
						actions={
							phase === 'ready' && (
								<Link to="/settings/browser#connections" className={buttonVariants({ variant: 'outline' })}>
									{t('settings.privacy.openConnections')}
								</Link>
							)
						}
					/>
					{state.restartRequired && (
						<SettingsRow
							title={t('settings.privacy.restartRequired')}
							description={t('settings.privacy.restartDescription')}
							actions={
								<Button type="button" disabled={busy} onClick={() => void restart()}>
									{t('settings.privacy.restart')}
								</Button>
							}
						/>
					)}
				</SettingsPanel>
			) : !failed ? (
				<SettingsPanel>
					<SettingsLoadingRows />
				</SettingsPanel>
			) : null}
			{state && <p className="text-sm text-muted-foreground">{t('settings.privacy.providerData')}</p>}
			{(error || failed) && (
				<SettingsNotice variant="destructive">
					{error ?? t('settings.privacy.loadFailed')}
				</SettingsNotice>
			)}
			<Lock />
			<Encryption />
			<Destinations />
			<Sites />
			<Storage />
		</SettingsPageShell>
	);
}
