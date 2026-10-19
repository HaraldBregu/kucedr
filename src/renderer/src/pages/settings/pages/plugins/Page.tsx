import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsPageHeader, SettingsPageShell } from '../../components';
import Installed from './Installed';

const PluginsPage = (): React.JSX.Element => {
	const { t } = useTranslation();
	const [query, setQuery] = useState('');

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.integrations.title')}
				description={t('settings.integrations.description')}
				action={
					<div className="relative w-full sm:w-64">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							type="text"
							role="searchbox"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t('settings.integrations.searchPlaceholder')}
							aria-label={t('settings.integrations.search')}
							className="rounded-xl px-9"
						/>
						{query && (
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="absolute right-1 top-1/2 -translate-y-1/2 hover:bg-transparent dark:hover:bg-transparent"
								onClick={() => setQuery('')}
								aria-label={t('settings.integrations.clearSearch')}
							>
								<X className="size-4" aria-hidden="true" />
							</Button>
						)}
					</div>
				}
			/>
			<Installed query={query} />
		</SettingsPageShell>
	);
};

export default PluginsPage;
