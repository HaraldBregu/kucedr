import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CloudCredential } from '@shared/credential_types';
import { SettingsRow } from '../../components';
import { SERVICE_NAMES } from './names';

type Mode = 'idle' | 'rename' | 'replace' | 'delete';

export function CredentialRow({
	credential,
	onChanged,
	onRemoved,
	onError,
}: {
	readonly credential: CloudCredential;
	readonly onChanged: (credential: CloudCredential) => void;
	readonly onRemoved: (id: string) => void;
	readonly onError: (message: string) => void;
}): React.JSX.Element {
	const [mode, setMode] = useState<Mode>('idle');
	const [value, setValue] = useState('');
	const [busy, setBusy] = useState(false);
	const [valid, setValid] = useState<boolean>();

	const run = async (action: () => Promise<void>): Promise<void> => {
		setBusy(true);
		try {
			await action();
			setMode('idle');
		} catch (error) {
			onError(error instanceof Error ? error.message : 'The request failed.');
		} finally {
			setValue('');
			setBusy(false);
		}
	};

	const open = (next: Mode): void => {
		setValue(next === 'rename' ? credential.label : '');
		setMode(next);
	};

	const editing = mode === 'rename' || mode === 'replace';

	return (
		<SettingsRow
			icon={KeyRound}
			title={credential.label}
			description={`${SERVICE_NAMES[credential.service]} · ${
				credential.lastFour ? `••••${credential.lastFour}` : 'Key saved'
			}`}
			actions={
				editing ? (
					<form
						className="flex items-center gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							void run(async () =>
								onChanged(
									mode === 'rename'
										? await window.credentials.rename(credential.id, value)
										: await window.credentials.replace(credential.id, value)
								)
							);
						}}
					>
						<Input
							className="h-7 w-48"
							aria-label={mode === 'rename' ? 'New name' : 'New API key'}
							type={mode === 'replace' ? 'password' : 'text'}
							autoComplete="off"
							autoFocus
							value={value}
							onChange={(event) => setValue(event.target.value)}
						/>
						<Button type="submit" size="xs" disabled={busy || !value.trim()}>
							Save
						</Button>
						<Button type="button" size="xs" variant="ghost" onClick={() => open('idle')}>
							Cancel
						</Button>
					</form>
				) : mode === 'delete' ? (
					<div className="flex items-center gap-2">
						<Button
							type="button"
							size="xs"
							variant="destructive"
							disabled={busy}
							onClick={() =>
								void run(async () => {
									await window.credentials.remove(credential.id);
									onRemoved(credential.id);
								})
							}
						>
							Confirm delete
						</Button>
						<Button type="button" size="xs" variant="ghost" onClick={() => open('idle')}>
							Cancel
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-1">
						{valid !== undefined && (
							<Badge variant={valid ? 'secondary' : 'destructive'}>{valid ? 'Valid' : 'Rejected'}</Badge>
						)}
						<Button
							type="button"
							size="xs"
							variant="ghost"
							disabled={busy}
							onClick={() =>
								void run(async () => setValid(await window.credentials.test(credential.id)))
							}
						>
							{busy ? 'Testing…' : 'Test'}
						</Button>
						<Button type="button" size="xs" variant="ghost" onClick={() => open('rename')}>
							Rename
						</Button>
						<Button type="button" size="xs" variant="ghost" onClick={() => open('replace')}>
							Replace
						</Button>
						<Button type="button" size="xs" variant="ghost" onClick={() => open('delete')}>
							Delete
						</Button>
					</div>
				)
			}
		/>
	);
}
