import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import type { StorageProvider } from '@shared/storage_types';
import { SettingsField, SettingsPanel } from '../../components';

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
			<Collapsible className="min-w-0 max-w-full overflow-hidden">
				<CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2.5 text-left">
					<div className="min-w-0 flex-1">
						<div className="truncate text-[13px] font-medium leading-4 text-foreground">
							{t('settings.storage.provider.title')}
						</div>
						<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
							{selected?.name ?? t('settings.storage.provider.placeholder')}
						</p>
					</div>
					<ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
				</CollapsibleTrigger>
				<CollapsibleContent className="border-t border-border/60">
					<div className="grid min-w-0 gap-3 px-3 py-3">
						<SettingsField
							id="cloud-storage-provider"
							label={t('settings.storage.provider.title')}
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
						>
						<Select
							items={providers.map((provider) => ({ value: provider.id, label: provider.name }))}
							value={selected?.id ?? null}
							onValueChange={(value) => {
								if (value) onChange(value);
							}}
							disabled={disabled || providers.length === 0}
						>
							<SelectTrigger
								id="cloud-storage-provider"
								className="w-full min-w-0 max-w-full text-xs"
								aria-describedby="cloud-storage-provider-description"
							>
								<SelectValue
									className="min-w-0 overflow-hidden"
									placeholder={t('settings.storage.provider.placeholder')}
								/>
							</SelectTrigger>
							<SelectContent>
								{providers.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										<span className="truncate">{provider.name}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						</SettingsField>
						<Link
							to="/settings/providers/storage"
							className={buttonVariants({ variant: 'link', size: 'xs', className: 'justify-self-start' })}
						>
							{t('settings.storage.provider.manage')}
						</Link>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SettingsPanel>
	);
}
