import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsPanel, SettingsSection } from '../../components';

export function CredentialUnlock({
	create,
	onUnlocked,
	onError,
}: {
	readonly create: boolean;
	readonly onUnlocked: () => void;
	readonly onError: (message: string) => void;
}): React.JSX.Element {
	const [passphrase, setPassphrase] = useState('');
	const [confirm, setConfirm] = useState('');
	const [busy, setBusy] = useState(false);
	const ready = passphrase.length >= 10 && (!create || passphrase === confirm);

	const submit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		setBusy(true);
		try {
			await window.credentials.unlock(passphrase);
			onUnlocked();
		} catch (error) {
			onError(error instanceof Error ? error.message : 'Could not unlock your API keys.');
		} finally {
			setPassphrase('');
			setConfirm('');
			setBusy(false);
		}
	};

	return (
		<SettingsSection
			title={create ? 'Create a passphrase' : 'Unlock your API keys'}
			description={
				create
					? 'Your keys are encrypted on this device with this passphrase before upload. It is never sent anywhere and cannot be recovered; if you lose it, your saved keys are lost.'
					: 'Enter the passphrase you chose for your cloud API keys. This device remembers it until you lock.'
			}
		>
			<SettingsPanel>
				<form className="flex flex-wrap items-center gap-2 p-4" onSubmit={(event) => void submit(event)}>
					<Input
						className="min-w-48 flex-1"
						aria-label="Passphrase"
						type="password"
						autoComplete={create ? 'new-password' : 'current-password'}
						placeholder="Passphrase (10+ characters)"
						value={passphrase}
						onChange={(event) => setPassphrase(event.target.value)}
					/>
					{create ? (
						<Input
							className="min-w-48 flex-1"
							aria-label="Confirm passphrase"
							type="password"
							autoComplete="new-password"
							placeholder="Confirm passphrase"
							value={confirm}
							onChange={(event) => setConfirm(event.target.value)}
						/>
					) : null}
					<Button type="submit" size="sm" disabled={busy || !ready}>
						{busy ? 'Working…' : create ? 'Create' : 'Unlock'}
					</Button>
				</form>
			</SettingsPanel>
		</SettingsSection>
	);
}
