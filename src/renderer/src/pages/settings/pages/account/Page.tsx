import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Activity } from './Activity';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
	SettingsValue,
} from '../../components';

const AccountPage: React.FC = () => {
	const { t } = useTranslation();
	const { state, localOnly, requireSignIn } = useAuth();
	const [sessionBusy, setSessionBusy] = useState(false);
	const [error, setError] = useState('');
	const [profileName, setProfileName] = useState<string>();
	const signedIn = state.status === 'signedIn' && !localOnly;

	useEffect(() => {
		if (!signedIn) {
			setProfileName(undefined);
			return;
		}
		let active = true;
		void window.auth
			.getProfile()
			.then(({ firstName, lastName }) => {
				if (active) setProfileName([firstName, lastName].filter(Boolean).join(' ') || undefined);
			})
			.catch(() => {
				if (active) setProfileName(undefined);
			});
		return () => {
			active = false;
		};
	}, [signedIn]);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title="Account"
				description="Manage your sign-in status."
				action={!signedIn ? <Button type="button" size="xs" onClick={requireSignIn}>Login</Button> : undefined}
			/>
			<SettingsSection
				title={t('settings.activity.title')}
				description={t('settings.activity.description')}
				className="my-2"
			>
				<Activity />
			</SettingsSection>
			{error ? (
				<SettingsNotice icon={AlertCircle} variant="destructive">
					{error}
				</SettingsNotice>
			) : null}
			{signedIn ? (
			<>
			<SettingsSection title="Identity">
				<SettingsPanel>
					<SettingsRow title="Status">
						<SettingsValue>Signed in</SettingsValue>
					</SettingsRow>
							{profileName || state.user?.displayName ? (
								<SettingsRow title="Name">
									<SettingsValue>{profileName ?? state.user?.displayName}</SettingsValue>
								</SettingsRow>
							) : null}
							<SettingsRow title="Email">
								<SettingsValue>{state.user?.email ?? 'Unavailable'}</SettingsValue>
							</SettingsRow>
							<SettingsRow title="Account ID">
								<SettingsValue>{state.user?.id ?? 'Unavailable'}</SettingsValue>
							</SettingsRow>
				</SettingsPanel>
			</SettingsSection>
			<SettingsSection title="Session">
				<SettingsPanel>
					<SettingsRow
						title="Sign out"
						description="You can continue using Kucedr on this device after signing out."
					>
							<Button
								type="button"
								size="xs"
								variant="outline"
								disabled={sessionBusy}
								onClick={() => {
									setError('');
									void window.win
										.confirmSignOut()
										.then((confirmed) => {
											if (!confirmed) return;
											setSessionBusy(true);
											void window.auth
												.signOut()
												.catch((cause) =>
													setError(cause instanceof Error ? cause.message : 'Could not sign out.')
												)
												.finally(() => setSessionBusy(false));
										})
										.catch((cause) =>
											setError(cause instanceof Error ? cause.message : 'Could not sign out.')
										);
								}}
							>
								{sessionBusy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
								Sign out
							</Button>
					</SettingsRow>
				</SettingsPanel>
			</SettingsSection>
			</>
			) : null}
		</SettingsPageShell>
	);
};

export default AccountPage;
