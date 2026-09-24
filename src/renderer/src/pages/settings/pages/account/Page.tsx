import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { AccountProfile } from '@shared/auth_types';
import { Activity, type ActivityRange } from './Activity';
import { ActivityHeader } from './Header';
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
	const { state, localOnly, requireSignIn } = useAuth();
	const [sessionBusy, setSessionBusy] = useState(false);
	const [error, setError] = useState('');
	const [profile, setProfile] = useState<AccountProfile>();
	const [profileError, setProfileError] = useState('');
	const [activityRange, setActivityRange] = useState<ActivityRange>('untilToday');
	const signedIn = state.status === 'signedIn' && !localOnly;
	const userId = signedIn ? state.user?.id : undefined;

	useEffect(() => {
		setProfile(undefined);
		setProfileError('');
		if (!userId) return;
		let active = true;
		void window.auth
			.getProfile()
			.then((result) => {
				if (active) setProfile(result);
			})
			.catch(() => {
				if (active) setProfileError('Could not load profile information.');
			});
		return () => {
			active = false;
		};
	}, [userId]);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title="Account"
				description="Manage your sign-in status."
				action={
					!signedIn ? (
						<Button type="button" size="xs" onClick={requireSignIn}>
							Login
						</Button>
					) : undefined
				}
			/>
			<section className="my-2 flex flex-col gap-4">
				<ActivityHeader range={activityRange} onRangeChange={setActivityRange} />
				<Activity range={activityRange} />
			</section>
			{error ? (
				<SettingsNotice icon={AlertCircle} variant="destructive">
					{error}
				</SettingsNotice>
			) : null}
			{profileError ? (
				<SettingsNotice icon={AlertCircle} variant="destructive">
					{profileError}
				</SettingsNotice>
			) : null}
			{signedIn ? (
				<>
					<SettingsSection title="Identity">
						<SettingsPanel>
							<SettingsRow title="Status">
								<SettingsValue>Signed in</SettingsValue>
							</SettingsRow>
							<SettingsRow title="First name">
								<SettingsValue>{profile?.firstName || 'Not set'}</SettingsValue>
							</SettingsRow>
							<SettingsRow title="Last name">
								<SettingsValue>{profile?.lastName || 'Not set'}</SettingsValue>
							</SettingsRow>
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
									{sessionBusy ? (
										<LoaderCircle className="animate-spin" aria-hidden="true" />
									) : null}
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
