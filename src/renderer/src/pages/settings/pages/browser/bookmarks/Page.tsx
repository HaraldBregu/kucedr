import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Star, Trash2 } from 'lucide-react';
import type { BrowserPlace } from '@shared/browser_import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	SettingsEmptyState,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../../components';
import { EditDialog } from '../EditDialog';

export default function BrowserBookmarksPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [bookmarks, setBookmarks] = useState<BrowserPlace[] | null>(null);
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState<{ url: string; values: Record<string, string> } | null>(null);
	const reload = (): void => void window.browserPane.bookmarks().then(setBookmarks);
	useEffect(reload, []);
	const needle = query.trim().toLowerCase();
	const shown = (bookmarks ?? []).filter(
		(item) => !needle || item.url.toLowerCase().includes(needle) || item.title.toLowerCase().includes(needle)
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.browser.bookmarksPage.title')}
				description={t('settings.browser.bookmarksPage.description')}
			/>
			{bookmarks?.length ? (
				<Input
					type="search"
					aria-label={t('common.search')}
					placeholder={t('settings.browser.bookmarksPage.search')}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			) : null}
			<SettingsPanel>
				{bookmarks !== null && shown.length === 0 ? (
					<SettingsEmptyState
						icon={Star}
						title={bookmarks.length ? t('settings.browser.noMatches') : t('settings.browser.bookmarksPage.empty')}
					/>
				) : null}
				{shown.map((item) => (
					<SettingsRow
						key={item.url}
						title={<span className="block truncate">{item.title || item.url}</span>}
						description={<span className="block truncate">{item.url}</span>}
						actionClassName="w-auto justify-end gap-1"
						actions={
							<>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t('common.edit')}
									title={t('common.edit')}
									onClick={() => setEditing({ url: item.url, values: { title: item.title, url: item.url } })}
								>
									<Pencil />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t('common.delete')}
									title={t('common.delete')}
									onClick={() => void window.browserPane.bookmarksDelete(item.url).then(reload)}
								>
									<Trash2 />
								</Button>
							</>
						}
					/>
				))}
			</SettingsPanel>
			<EditDialog
				title={t('settings.browser.bookmarksPage.edit')}
				fields={[
					{ name: 'title', label: t('settings.browser.bookmarksPage.name') },
					{ name: 'url', label: t('settings.browser.bookmarksPage.address'), type: 'url' },
				]}
				values={editing?.values ?? null}
				onClose={() => setEditing(null)}
				onSave={async (values) => {
					if (!editing) return;
					await window.browserPane.bookmarksUpdate(editing.url, { url: values.url ?? '', title: values.title ?? '' });
					reload();
				}}
			/>
		</SettingsPageShell>
	);
}
