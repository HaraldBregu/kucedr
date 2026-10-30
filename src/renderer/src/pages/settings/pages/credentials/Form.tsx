import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
	CLOUD_CREDENTIAL_SERVICES,
	type CloudCredential,
	type CloudCredentialService,
} from '@shared/credential_types';
import { SERVICE_NAMES } from './names';

export function CredentialForm({
	onCreated,
	onError,
}: {
	readonly onCreated: (credential: CloudCredential) => void;
	readonly onError: (message: string) => void;
}): React.JSX.Element {
	const [service, setService] = useState<CloudCredentialService>('openai');
	const [label, setLabel] = useState('');
	const [secret, setSecret] = useState('');
	const [busy, setBusy] = useState(false);

	const submit = async (event: React.FormEvent): Promise<void> => {
		event.preventDefault();
		setBusy(true);
		try {
			onCreated(await window.credentials.create({ service, label, secret }));
			setLabel('');
		} catch (error) {
			onError(error instanceof Error ? error.message : 'Could not save the API key.');
		} finally {
			setSecret('');
			setBusy(false);
		}
	};

	return (
		<form className="flex flex-wrap items-center gap-2 p-4" onSubmit={(event) => void submit(event)}>
			<Select
				value={service}
				onValueChange={(value) => value && setService(value as CloudCredentialService)}
			>
				<SelectTrigger className="w-32" aria-label="Service">
					<SelectValue>{SERVICE_NAMES[service]}</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{CLOUD_CREDENTIAL_SERVICES.map((value) => (
						<SelectItem key={value} value={value}>
							{SERVICE_NAMES[value]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Input
				className="w-40"
				aria-label="Name"
				placeholder="Name, e.g. Work"
				maxLength={100}
				value={label}
				onChange={(event) => setLabel(event.target.value)}
			/>
			<Input
				className="min-w-48 flex-1"
				aria-label="API key"
				type="password"
				autoComplete="off"
				spellCheck={false}
				placeholder="API key"
				value={secret}
				onChange={(event) => setSecret(event.target.value)}
			/>
			<Button type="submit" size="sm" disabled={busy || !label.trim() || secret.trim().length < 8}>
				{busy ? 'Saving…' : 'Add key'}
			</Button>
		</form>
	);
}
