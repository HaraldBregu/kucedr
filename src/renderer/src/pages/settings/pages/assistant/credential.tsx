import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { CLOUD_CREDENTIAL_SERVICES, type CloudCredential } from '@shared/credential_types';
import { SettingsRow } from '../../components';

const LOCAL = 'local';

export function ChatCredentialSelect({ providerId }: { readonly providerId: string }): React.JSX.Element | null {
	const { state, localOnly } = useAuth();
	const userId = state.status === 'signedIn' && !localOnly ? state.user?.id : undefined;
	const [selected, setSelected] = useState<string>();
	const [credentials, setCredentials] = useState<CloudCredential[]>();
	const [error, setError] = useState('');
	const supported = (CLOUD_CREDENTIAL_SERVICES as readonly string[]).includes(providerId);

	useEffect(() => {
		let active = true;
		setCredentials(undefined);
		setError('');
		void window.agent.getCredentialId().then((id) => active && setSelected(id));
		if (userId && supported) {
			void window.credentials
				.list()
				.then((list) => active && setCredentials(list.filter((entry) => entry.service === providerId)))
				.catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : ''));
		}
		return () => {
			active = false;
		};
	}, [providerId, userId, supported]);

	if (!supported || (!userId && !selected)) return null;

	const current = credentials?.find((entry) => entry.id === selected);
	const label = !selected
		? 'Local key'
		: current
			? current.label
			: credentials
				? 'Unavailable key — choose another'
				: 'Cloud key';

	const change = (value: string | null): void => {
		const next = !value || value === LOCAL ? undefined : value;
		void window.agent
			.setCredentialId(next ?? null)
			.then(() => setSelected(next))
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : ''));
	};

	return (
		<SettingsRow
			title="API key"
			icon={KeyRound}
			description={error || 'Use a key saved on this device or one stored in your account.'}
			actions={
				<Select value={selected ?? LOCAL} onValueChange={change}>
					<SelectTrigger className="w-48" aria-label="API key">
						<SelectValue>{label}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={LOCAL}>Local key</SelectItem>
						{credentials?.map((entry) => (
							<SelectItem key={entry.id} value={entry.id}>
								{entry.lastFour ? `${entry.label} ••••${entry.lastFour}` : entry.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			}
		/>
	);
}
