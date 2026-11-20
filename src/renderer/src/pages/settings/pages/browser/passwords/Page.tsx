import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import type { BrowserLogin } from '@shared/browser_import';
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

function site(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

export default function BrowserPasswordsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [logins, setLogins] = useState<BrowserLogin[] | null>(null);
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState<{ id: string; values: Record<string, string> } | null>(null);
	const [never, setNever] = useState<string[]>([]);
	const reload = (): void => {
		void window.browserPane.passwordsList().then(setLogins);
		void window.browserPane.passwordsNever().then(setNever);
	};
	useEffect(reload, []);
	const needle = query.trim().toLowerCase();
	const shown = (logins ?? []).filter(
		(login) => !needle || login.url.toLowerCase().includes(needle) || login.username.toLowerCase().includes(needle)
	);

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.browser.passwordsPage.title')}
				description={t('settings.browser.passwordsPage.description')}
				action={
					logins?.length ? (
						<Button
							type="button"
							variant="outline"
							onClick={() => void window.browserPane.passwordsClear().then((deleted) => deleted && reload())}
						>
							{t('settings.browser.passwordsClear')}
						</Button>
					) : null
				}
			/>
			{logins?.length ? (
				<Input
					type="search"
					aria-label={t('common.search')}
					placeholder={t('settings.browser.passwordsPage.search')}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			) : null}
			<SettingsPanel>
				{logins !== null && shown.length === 0 ? (
					<SettingsEmptyState
						icon={KeyRound}
						title={logins.length ? t('settings.browser.noMatches') : t('settings.browser.passwordsPage.empty')}
					/>
				) : null}
				{shown.map((login) => (
					<SettingsRow
						key={login.id}
						title={site(login.url)}
						description={login.username || t('settings.browser.passwordsPage.noUsername')}
						actionClassName="w-auto justify-end gap-1"
						actions={
							<>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t('common.edit')}
									title={t('common.edit')}
									onClick={() =>
										setEditing({ id: login.id, values: { url: login.url, username: login.username, password: '' } })
									}
								>
									<Pencil />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t('common.delete')}
									title={t('common.delete')}
									onClick={() => void window.browserPane.passwordsDelete(login.id).then((deleted) => deleted && reload())}
								>
									<Trash2 />
								</Button>
							</>
						}
					/>
				))}
			</SettingsPanel>
			{never.length ? (
				<SettingsSection
					title={t('settings.browser.passwordsPage.never')}
					description={t('settings.browser.passwordsPage.neverDescription')}
				>
					<SettingsPanel>
						{never.map((site) => (
							<SettingsRow
								key={site}
								title={site}
								actionClassName="w-auto justify-end"
								actions={
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={t('settings.browser.passwordsPage.neverRemove', { site })}
										title={t('settings.browser.passwordsPage.neverRemove', { site })}
										onClick={() => void window.browserPane.passwordsNeverRemove(site).then(reload)}
									>
										<X />
									</Button>
								}
							/>
						))}
					</SettingsPanel>
				</SettingsSection>
			) : null}
			<EditDialog
				title={t('settings.browser.passwordsPage.edit')}
				description={t('settings.browser.passwordsPage.editDescription')}
				fields={[
					{ name: 'url', label: t('settings.browser.passwordsPage.site'), type: 'url' },
					{ name: 'username', label: t('settings.browser.passwordsPage.username') },
					{
						name: 'password',
						label: t('settings.browser.passwordsPage.password'),
						type: 'password',
						placeholder: t('settings.browser.passwordsPage.passwordKeep'),
					},
				]}
				values={editing?.values ?? null}
				onClose={() => setEditing(null)}
				onSave={async (values) => {
					if (!editing) return;
					await window.browserPane.passwordsUpdate(editing.id, {
						url: values.url ?? '',
						username: values.username ?? '',
						password: values.password ?? '',
					});
					reload();
				}}
			/>
		</SettingsPageShell>
	);
}
