import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { StorageProvider } from '@shared/storage_types';
import { SettingsPanel, SettingsRow } from '../../components';

interface ProviderProps {
	readonly providers: readonly StorageProvider[];
	readonly providerId?: string;
	readonly disabled: boolean;
	readonly onChange: (providerId: string) => void;
}

export default function Provider({
	providers,
	providerId,
	disabled,
	onChange,
}: ProviderProps): React.JSX.Element {
	const { t } = useTranslation();
	const selected = providers.find((provider) => provider.id === providerId);

	return (
		<SettingsPanel>
			<SettingsRow
				title={t('settings.storage.provider.title')}
				description={
					selected
						? `${selected.bucket} · ${selected.region}`
						: t(
								providers.length === 0
									? 'settings.storage.provider.empty'
									: providerId
										? 'settings.storage.provider.missing'
										: 'settings.storage.provider.description'
							)
				}
				actions={
					<div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
						<Select
							items={providers.map((provider) => ({ value: provider.id, label: provider.name }))}
							value={selected?.id ?? null}
							onValueChange={(value) => {
								if (value) onChange(value);
							}}
							disabled={disabled || providers.length === 0}
						>
							<SelectTrigger
								className="w-full max-w-full text-xs sm:w-64"
								aria-label={t('settings.storage.provider.title')}
							>
								<SelectValue placeholder={t('settings.storage.provider.placeholder')} />
							</SelectTrigger>
							<SelectContent>
								{providers.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										<span className="truncate">{provider.name}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Link
							to="/settings/providers/storage"
							className={buttonVariants({ variant: 'link', size: 'xs' })}
						>
							{t('settings.storage.provider.manage')}
						</Link>
					</div>
				}
			/>
		</SettingsPanel>
	);
}
