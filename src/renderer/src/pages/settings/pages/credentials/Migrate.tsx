import React, { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { LocalCredential } from '@shared/credential_types';
import { SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import { SERVICE_NAMES } from './names';

export function CredentialMigrate({
	userId,
	onUploaded,
	onError,
}: {
	readonly userId: string;
	readonly onUploaded: () => void;
	readonly onError: (message: string) => void;
}): React.JSX.Element | null {
	const [local, setLocal] = useState<LocalCredential[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);

	const load = (): Promise<void> => window.credentials.listLocal().then(setLocal);

	useEffect(() => {
		let active = true;
		setLocal([]);
		setSelected(new Set());
		void window.credentials
			.listLocal()
			.then((result) => active && setLocal(result))
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [userId]);

	if (local.length === 0) return null;

	const upload = async (): Promise<void> => {
		setBusy(true);
		try {
			const results = await window.credentials.migrate([...selected]);
			const failed = results.filter((result) => result.error);
			if (failed.length) onError(`${failed.length} key(s) were not uploaded and remain on this device.`);
			setSelected(new Set());
			onUploaded();
			await load();
		} catch (error) {
			onError(error instanceof Error ? error.message : 'Upload failed. Local keys were kept.');
		} finally {
			setBusy(false);
		}
	};

	const removeLocal = async (localId: string): Promise<void> => {
		try {
			await window.credentials.removeLocal(localId);
			onUploaded();
			await load();
		} catch (error) {
			onError(error instanceof Error ? error.message : 'The local copy was kept.');
		}
	};

	return (
		<SettingsSection
			title="Keys on this device"
			description="Choose which local keys to upload to your account. Local copies stay until you remove them."
			action={
				<Button type="button" size="xs" disabled={busy || selected.size === 0} onClick={() => void upload()}>
					{busy ? 'Uploading…' : 'Upload selected'}
				</Button>
			}
		>
			<SettingsPanel>
				{local.map((entry) => (
					<SettingsRow
						key={entry.localId}
						icon={HardDrive}
						title={SERVICE_NAMES[entry.service]}
						description={`${entry.lastFour ? `••••${entry.lastFour}` : 'Local key'}${
							entry.uploadedCredentialId ? ' · Uploaded' : ''
						}`}
						actions={
							entry.uploadedCredentialId ? (
								<Button
									type="button"
									size="xs"
									variant="ghost"
									onClick={() => void removeLocal(entry.localId)}
								>
									Remove local copy
								</Button>
							) : (
								<Checkbox
									aria-label={`Upload ${SERVICE_NAMES[entry.service]} key`}
									checked={selected.has(entry.localId)}
									onCheckedChange={(checked) =>
										setSelected((current) => {
											const next = new Set(current);
											if (checked) next.add(entry.localId);
											else next.delete(entry.localId);
											return next;
										})
									}
								/>
							)
						}
					/>
				))}
			</SettingsPanel>
		</SettingsSection>
	);
}
