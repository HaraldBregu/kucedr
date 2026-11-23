import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Trash2 } from 'lucide-react';
import type { BrowserVisit } from '@shared/browser_import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	SettingsEmptyState,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../../components';

export default function BrowserHistoryPage(): React.JSX.Element {
	const { t, i18n } = useTranslation();
	const [visits, setVisits] = useState<BrowserVisit[] | null>(null);
	const [query, setQuery] = useState('');
	const reload = (): void => void window.browserPane.history().then(setVisits);
	useEffect(reload, []);
	const needle = query.trim().toLowerCase();
	const days = new Map<string, BrowserVisit[]>();
	for (const item of visits ?? []) {
		if (needle && !item.url.toLowerCase().includes(needle) && !item.title.toLowerCase().includes(needle)) continue;
		const day = new Date(item.last).toLocaleDateString(i18n.language, { dateStyle: 'full' });
		days.set(day, [...(days.get(day) ?? []), item]);
	}

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.browser.historyPage.title')}
				description={t('settings.browser.historyPage.description')}
				action={
					visits?.length ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => void window.browserPane.historyClear().then((cleared) => cleared && reload())}
						>
							{t('settings.browser.clearHistory')}
						</Button>
					) : null
				}
			/>
			{visits?.length ? (
				<Input
					type="search"
					aria-label={t('common.search')}
					placeholder={t('settings.browser.historyPage.search')}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			) : null}
			{visits !== null && days.size === 0 ? (
				<SettingsPanel>
					<SettingsEmptyState
						icon={History}
						title={visits.length ? t('settings.browser.noMatches') : t('settings.browser.historyPage.empty')}
					/>
				</SettingsPanel>
			) : null}
			{[...days].map(([day, items]) => (
				<SettingsSection key={day} title={day}>
					<SettingsPanel>
						{items.map((item) => (
							<SettingsRow
								key={item.url}
								title={<span className="block truncate">{item.title || item.url}</span>}
								description={
									<span className="block truncate">
										{new Date(item.last).toLocaleTimeString(i18n.language, { timeStyle: 'short' })} · {item.url}
									</span>
								}
								actionClassName="w-auto justify-end"
								actions={
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={t('common.delete')}
										title={t('common.delete')}
										onClick={() => void window.browserPane.historyDelete(item.url).then(reload)}
									>
										<Trash2 />
									</Button>
								}
							/>
						))}
					</SettingsPanel>
				</SettingsSection>
			))}
		</SettingsPageShell>
	);
}
