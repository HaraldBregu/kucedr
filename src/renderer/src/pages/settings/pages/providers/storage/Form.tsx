import { useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import type { StorageProvider, StorageProviderInput } from '@shared/storage_types';
import { getErrorMessage } from '../../../../start/setupConstants';
import { SettingsField, SettingsNotice } from '../../../components';

const FIELDS = [
	{ key: 'name', type: 'text', placeholder: 'Production files' },
	{ key: 'bucket', type: 'text', placeholder: 'my-bucket' },
	{ key: 'region', type: 'text', placeholder: 'us-east-1' },
	{ key: 'endpoint', type: 'url', placeholder: 'https://s3.example.com' },
	{ key: 'accessKeyId', type: 'text', placeholder: '' },
	{ key: 'secretAccessKey', type: 'password', placeholder: '' },
] as const;

interface StorageFormProps {
	readonly provider?: StorageProvider;
	readonly onSaved: (provider: StorageProvider) => void;
	readonly onCancel: () => void;
}

export default function StorageForm({
	provider,
	onSaved,
	onCancel,
}: StorageFormProps): React.JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<StorageProviderInput>({
		id: provider?.id,
		name: provider?.name ?? '',
		bucket: provider?.bucket ?? '',
		region: provider?.region ?? 'us-east-1',
		endpoint: provider?.endpoint ?? '',
		accessKeyId: provider?.accessKeyId ?? '',
		secretAccessKey: '',
		forcePathStyle: provider?.forcePathStyle ?? false,
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const canSave =
		['name', 'bucket', 'region', 'accessKeyId'].every((key) =>
			String(draft[key as keyof StorageProviderInput] ?? '').trim()
		) &&
		(provider?.hasSecretAccessKey || !!draft.secretAccessKey?.trim());

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !saving) onCancel();
			}}
		>
			<DialogContent
				className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
				showCloseButton={!saving}
			>
				<DialogHeader>
					<DialogTitle>
						{t(provider ? 'settings.storageProviders.editTitle' : 'settings.storageProviders.add')}
					</DialogTitle>
					<DialogDescription>{t('settings.storageProviders.formDescription')}</DialogDescription>
				</DialogHeader>
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (saving || !canSave) return;
						setSaving(true);
						setError('');
						void window.storage
							.saveProvider(draft)
							.then(onSaved)
							.catch((err: unknown) => {
								setError(getErrorMessage(err, t('settings.storageProviders.saveError')));
							})
							.finally(() => setSaving(false));
					}}
				>
					{error && (
						<SettingsNotice variant="destructive" icon={AlertTriangle}>
							{error}
						</SettingsNotice>
					)}
					<fieldset disabled={saving} className="grid min-w-0 gap-4 sm:grid-cols-2">
						{FIELDS.map((field) => {
							const description =
								field.key === 'endpoint'
									? t('settings.storageProviders.endpointHint')
									: field.key === 'secretAccessKey' && provider?.hasSecretAccessKey
										? t('settings.storageProviders.secretHint')
										: undefined;
							return (
								<SettingsField
									key={field.key}
									id={`storage-${field.key}`}
									label={t(`settings.storageProviders.fields.${field.key}`)}
									description={description}
									className={
										field.key === 'endpoint' || field.key === 'name' ? 'sm:col-span-2' : undefined
									}
								>
									<Input
										id={`storage-${field.key}`}
										type={field.type}
										autoComplete="off"
										spellCheck={false}
										aria-describedby={description ? `storage-${field.key}-description` : undefined}
										required={
											field.key !== 'endpoint' &&
											!(field.key === 'secretAccessKey' && provider?.hasSecretAccessKey)
										}
										placeholder={field.placeholder}
										value={draft[field.key] ?? ''}
										onChange={(event) =>
											setDraft((current) => ({ ...current, [field.key]: event.target.value }))
										}
									/>
								</SettingsField>
							);
						})}
						<SettingsField
							id="storage-path-style"
							label={t('settings.storageProviders.fields.forcePathStyle')}
						>
							<Switch
								id="storage-path-style"
								checked={draft.forcePathStyle}
								onCheckedChange={(checked) =>
									setDraft((current) => ({ ...current, forcePathStyle: checked }))
								}
							/>
						</SettingsField>
					</fieldset>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
							{t('common.cancel')}
						</Button>
						<Button type="submit" disabled={saving || !canSave}>
							{saving && <LoaderCircle className="size-3.5 animate-spin" />}
							{t('common.save')}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
