import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, HardDrive } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { StorageProvider } from '@shared/storage_types';
import { SettingsPanel } from '../../components';

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
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const selected = providers.find((provider) => provider.id === providerId);
	const providerTitle = t('settings.storage.provider.title');
	const providerPlaceholder = t('settings.storage.provider.placeholder');
	const providerDescription = selected
		? `${selected.bucket} · ${selected.region}`
		: t(
				providers.length === 0
					? 'settings.storage.provider.empty'
					: providerId
						? 'settings.storage.provider.missing'
						: 'settings.storage.provider.description'
			);
	const providerSummary = selected?.name ??
		(providers.length === 0 || providerId ? providerDescription : providerPlaceholder);

	return (
		<SettingsPanel>
			<Collapsible className="min-w-0 max-w-full overflow-hidden">
				<div className="flex w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
					<CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-4 text-left">
						<HardDrive className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						<div className="min-w-0 flex-1">
							<div className="truncate text-[13px] font-medium leading-4 text-foreground">
								{providerTitle}
							</div>
							<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
								{providerSummary}
							</p>
						</div>
						<ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
					</CollapsibleTrigger>
					<Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={disabled || providers.length === 0}
								aria-label={providerTitle}
								className="min-w-40 max-w-full justify-between text-xs"
							>
								<span className="min-w-0 truncate">
									{selected?.name ?? providerPlaceholder}
								</span>
								<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
							</Button>
						</PopoverTrigger>
						<PopoverContent
							align="end"
							collisionPadding={12}
							className="max-h-[var(--radix-popover-content-available-height)] w-max max-w-[calc(100vw-2rem)] overflow-y-auto p-1"
						>
							<div role="menu" aria-label={providerTitle} className="min-w-0">
								{providers.map((provider) => {
									const isSelected = provider.id === selected?.id;
									return (
										<button
											key={provider.id}
											type="button"
											role="menuitemradio"
											aria-checked={isSelected}
											onClick={() => {
												onChange(provider.id);
												setDropdownOpen(false);
											}}
											className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
										>
											<span className="min-w-0 truncate whitespace-nowrap text-sm text-foreground">
												{provider.name}
											</span>
											<Check
												className={`size-4 shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
												aria-hidden="true"
											/>
										</button>
									);
								})}
							</div>
						</PopoverContent>
					</Popover>
				</div>
				<CollapsibleContent className="border-t border-border/60">
					<div className="grid min-w-0 gap-3 px-4 py-4">
						<p className="text-[11px] leading-4 text-muted-foreground">{providerDescription}</p>
						<Link
							to="/settings/providers/storage"
							className={buttonVariants({
								variant: 'link',
								size: 'xs',
								className: 'justify-self-start',
							})}
						>
							{t('settings.storage.provider.manage')}
						</Link>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SettingsPanel>
	);
}
