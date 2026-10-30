import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { CloudCredential } from '@shared/credential_types';
import {
	SettingsEmptyState,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsSection,
} from '../../components';
import { CredentialForm } from './Form';
import { CredentialMigrate } from './Migrate';
import { CredentialRow } from './Row';

const CredentialsPage: React.FC = () => {
	const { state, localOnly, requireSignIn } = useAuth();
	const userId = state.status === 'signedIn' && !localOnly ? state.user?.id : undefined;
	const [list, setList] = useState<{ userId: string; credentials: CloudCredential[] }>();
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const credentials = list && list.userId === userId ? list.credentials : undefined;

	useEffect(() => {
		setList(undefined);
		setError('');
		if (!userId) return;
		let active = true;
		void window.credentials
			.list()
			.then((result) => active && setList({ userId, credentials: result }))
			.catch((cause: unknown) => {
				if (active) setError(cause instanceof Error ? cause.message : 'Could not load API keys.');
			});
		return () => {
			active = false;
		};
	}, [userId, reload]);

	const update = useCallback(
		(change: (current: CloudCredential[]) => CloudCredential[]) => {
			setList((current) =>
				current && current.userId === userId
					? { userId: current.userId, credentials: change(current.credentials) }
					: current
			);
		},
		[userId]
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				icon={KeyRound}
				title="Cloud API keys"
				description="Keys are stored encrypted in your account and used only by the Kucedr backend. They are never sent back to this device."
			/>
			{!userId ? (
				<SettingsEmptyState
					icon={KeyRound}
					title="Sign in to use cloud API keys"
					description="Local keys keep working while you are signed out."
				>
					<Button type="button" size="xs" onClick={requireSignIn}>
						Login
					</Button>
				</SettingsEmptyState>
			) : (
				<>
					{error ? (
						<SettingsNotice icon={AlertCircle} variant="destructive">
							<span className="flex items-center gap-2">
								{error}
								<Button type="button" size="xs" variant="ghost" onClick={() => setReload((n) => n + 1)}>
									Retry
								</Button>
							</span>
						</SettingsNotice>
					) : null}
					<SettingsSection title="Saved keys">
						<SettingsPanel>
							{!credentials ? (
								error ? null : <SettingsLoadingRows rows={2} />
							) : credentials.length === 0 ? (
								<SettingsEmptyState title="No cloud API keys yet" description="Add one below." />
							) : (
								credentials.map((credential) => (
									<CredentialRow
										key={credential.id}
										credential={credential}
										onError={setError}
										onChanged={(next) =>
											update((current) => current.map((entry) => (entry.id === next.id ? next : entry)))
										}
										onRemoved={(id) => update((current) => current.filter((entry) => entry.id !== id))}
									/>
								))
							)}
						</SettingsPanel>
					</SettingsSection>
					<SettingsSection title="Add a key">
						<SettingsPanel>
							<CredentialForm
								onError={setError}
								onCreated={(credential) => {
									setError('');
									update((current) => [...current, credential]);
								}}
							/>
						</SettingsPanel>
					</SettingsSection>
					<CredentialMigrate
						userId={userId}
						onError={setError}
						onUploaded={() => setReload((n) => n + 1)}
					/>
				</>
			)}
		</SettingsPageShell>
	);
};

export default CredentialsPage;
