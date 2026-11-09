import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { StorageService } from '@shared/storage_types';
import { SettingsPanel, SettingsRow } from '../../components';

interface ServiceProps {
	readonly services: readonly StorageService[];
	readonly value?: string;
	readonly disabled: boolean;
	readonly onChange: (serviceId: string) => void;
}

export default function Service({
	services,
	value,
	disabled,
	onChange,
}: ServiceProps): React.JSX.Element {
	const { t } = useTranslation();
	const selected = services.find((service) => service.id === value);

	return (
		<SettingsPanel>
			<SettingsRow
				title={t('settings.storage.service.title')}
				icon={HardDrive}
				description={t('settings.storage.service.description')}
				actions={
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Select
							value={value ?? null}
							onValueChange={(next: string | null) => next && onChange(next)}
							disabled={disabled}
						>
							<SelectTrigger
								size="sm"
								className="w-48 max-w-full text-xs"
								aria-label={t('settings.storage.service.title')}
							>
								<SelectValue placeholder={t('settings.storage.service.placeholder')}>
									{selected ? `${selected.pluginName} - ${selected.name}` : undefined}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{services.map((service) => (
									<SelectItem key={service.id} value={service.id} disabled={!service.configured}>
										{service.pluginName} - {service.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{(selected ?? services[0]) && (
							<Button
								variant="outline"
								size="sm"
								nativeButton={false}
								render={
									<Link
										to={`/settings/plugins/${encodeURIComponent((selected ?? services[0]).pluginId)}`}
									/>
								}
							>
								{t('settings.storage.service.configure')}
							</Button>
						)}
					</div>
				}
			/>
		</SettingsPanel>
	);
}
