import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
	CLOUD_CREDENTIAL_SERVICES,
	type CloudCredential,
	type CloudCredentialService,
} from '@shared/credential_types';
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
import { SERVICE_NAMES } from './names';
import { CredentialRow } from './Row';

interface Loaded {
	userId: string;
	status: CredentialVaultStatus;
	credentials: CloudCredential[];
	active: Record<string, string>;
}

const CredentialsPage: React.FC = () => {
	const { state, localOnly, requireSignIn } = useAuth();
	const userId = state.status === 'signedIn' && !localOnly ? state.user?.id : undefined;
	const [loaded, setLoaded] = useState<Loaded>();
	const [error, setError] = useState('');
	const [reload, setReload] = useState(0);
	const current = loaded && loaded.userId === userId ? loaded : undefined;

	useEffect(() => {
		setLoaded(undefined);
		setError('');
		if (!userId) return;
		let active = true;
		void Promise.all([window.credentials.list(), window.credentials.active()])
			.then(([credentials, selection]) => {
				if (active) setLoaded({ userId, credentials, active: selection });
			})
			.catch((cause: unknown) => {
				if (active) setError(cause instanceof Error ? cause.message : 'Could not load API keys.');
			});
		return () => {
			active = false;
		};
	}, [userId, reload]);

	const update = useCallback(
		(change: (value: Loaded) => Omit<Loaded, 'userId'>) => {
			setLoaded((value) =>
				value && value.userId === userId ? { userId: value.userId, ...change(value) } : value
			);
		},
		[userId]
	);

	const activate = async (service: CloudCredentialService, id: string | null): Promise<void> => {
		await window.credentials.activate(service, id);
		update((value) => {
			const { [service]: _previous, ...rest } = value.active;
			return { credentials: value.credentials, active: id ? { ...rest, [service]: id } : rest };
		});
	};

	const services = CLOUD_CREDENTIAL_SERVICES.filter((service) =>
		current?.credentials.some((credential) => credential.service === service)
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				icon={KeyRound}
				title="Cloud API keys"
				description="Keys are stored encrypted in your account and used only by the Kucedr backend. Each plugin uses the key marked “In use”, or its local key when none is."
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
					{!current ? (
						error ? null : (
							<SettingsPanel>
								<SettingsLoadingRows rows={2} />
							</SettingsPanel>
						)
					) : services.length === 0 ? (
						<SettingsPanel>
							<SettingsEmptyState title="No cloud API keys yet" description="Add one below." />
						</SettingsPanel>
					) : (
						services.map((service) => (
							<SettingsSection
								key={service}
								title={SERVICE_NAMES[service]}
								action={
									current.active[service] ? (
										<Button
											type="button"
											size="xs"
											variant="ghost"
											onClick={() =>
												void activate(service, null).catch((cause: unknown) =>
													setError(cause instanceof Error ? cause.message : 'The request failed.')
												)
											}
										>
											Use local key
										</Button>
									) : undefined
								}
							>
								<SettingsPanel>
									{current.credentials
										.filter((credential) => credential.service === service)
										.map((credential) => (
											<CredentialRow
												key={credential.id}
												credential={credential}
												active={current.active[service] === credential.id}
												onActivate={() => activate(service, credential.id)}
												onError={setError}
												onChanged={(next) =>
													update((value) => ({
														active: value.active,
														credentials: value.credentials.map((entry) =>
															entry.id === next.id ? next : entry
														),
													}))
												}
												onRemoved={(id) =>
													update((value) => ({
														active: Object.fromEntries(
															Object.entries(value.active).filter(([, entry]) => entry !== id)
														),
														credentials: value.credentials.filter((entry) => entry.id !== id),
													}))
												}
											/>
										))}
								</SettingsPanel>
							</SettingsSection>
						))
					)}
					<SettingsSection title="Add a key">
						<SettingsPanel>
							<CredentialForm
								onError={setError}
								onCreated={(credential) => {
									setError('');
									update((value) => ({
										active: value.active,
										credentials: [...value.credentials, credential],
									}));
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
