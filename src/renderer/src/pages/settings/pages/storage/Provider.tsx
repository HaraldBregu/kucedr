import { useTranslation } from 'react-i18next';
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
	readonly disabled?: boolean;
	readonly onChange: (providerId: string) => void;
}

export default function Provider({
	providers,
	providerId,
	disabled = false,
	onChange,
}: ProviderProps): React.JSX.Element {
	const { t } = useTranslation();
	const selectedProvider = providers.find((provider) => provider.id === providerId);

	return (
		<SettingsPanel>
			<SettingsRow
				title={t('settings.storage.provider.title')}
				description={t('settings.storage.provider.description')}
				actions={
					<Select
						value={providerId ?? null}
						onValueChange={(value) => {
							if (value) onChange(value);
						}}
						disabled={disabled || providers.length === 0}
					>
						<SelectTrigger
							className="min-w-40 max-w-full text-xs"
							aria-label={t('settings.storage.provider.title')}
						>
							<SelectValue placeholder={t('settings.storage.provider.placeholder')}>
								{selectedProvider?.name}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{providers.map((provider) => (
								<SelectItem key={provider.id} value={provider.id}>
									{provider.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				}
			/>
		</SettingsPanel>
	);
}
