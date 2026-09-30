import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CatalogService } from '@shared/provider_types';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { openExternalUrl } from '@/lib/external-links';

export function ChannelConnect({
	service,
	configured,
	saving,
	error,
	onClose,
	onSave,
}: {
	readonly service: CatalogService | null;
	readonly configured: boolean;
	readonly saving: boolean;
	readonly error: string;
	readonly onClose: () => void;
	readonly onSave: (apiKey: string) => Promise<boolean>;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [values, setValues] = useState<Record<string, string>>({});
	const credentials = service?.credentials ?? [];
	const canSave =
		credentials.length > 0 &&
		credentials.every((credential) => !credential.required || values[credential.key]?.trim());

	return (
		<Dialog open={Boolean(service)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{configured
							? t('settings.channels.editToken')
							: t('settings.integrations.add', { name: service?.provider.name })}
					</DialogTitle>
					{service?.instructions && (
						<DialogDescription>{service.instructions}</DialogDescription>
					)}
				</DialogHeader>
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const apiKey = values.apiKey?.trim();
						if (!apiKey || saving) return;
						void onSave(apiKey).then((saved) => {
							if (saved) onClose();
						});
					}}
				>
					<div className="grid gap-4 py-2">
						{credentials.map((credential) => (
							<div key={credential.key} className="grid gap-2">
								<Label htmlFor={`channel-${service?.provider.id}-${credential.key}`}>
									{credential.label}
								</Label>
								<Input
									id={`channel-${service?.provider.id}-${credential.key}`}
									type={credential.type}
									autoComplete="off"
									value={values[credential.key] ?? ''}
									disabled={saving}
									required={credential.required}
									spellCheck={false}
									onChange={(event) =>
										setValues((current) => ({
											...current,
											[credential.key]: event.target.value,
										}))
									}
								/>
							</div>
						))}
						{service?.provider.apiKeyUrl && (
							<Button
								type="button"
								variant="link"
								size="sm"
								className="h-auto w-fit px-0"
								onClick={() => void openExternalUrl(service.provider.apiKeyUrl!)}
							>
								<ExternalLink className="size-3.5" />
								{t('settings.channels.getToken')}
							</Button>
						)}
						{error && (
							<p role="alert" className="text-xs text-destructive">
								{error}
							</p>
						)}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" disabled={saving} onClick={onClose}>
							{t('common.cancel')}
						</Button>
						<Button type="submit" disabled={!canSave || saving}>
							{t('common.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
