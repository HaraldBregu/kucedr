import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
	BrowserImportSummary,
	BrowserLibraryCounts,
	BrowserPasswordStatus,
	BrowserSource,
} from '@shared/browser_import';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';

const KINDS = ['bookmarks', 'history', 'settings'] as const;
const PICKS_FILES_AND_FOLDERS_TOGETHER = navigator.platform.startsWith('Mac');

export default function BrowserSettingsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [sources, setSources] = useState<BrowserSource[] | null>(null);
	const [skipped, setSkipped] = useState<string[]>([]);
	const [kinds, setKinds] = useState({ bookmarks: true, history: true, settings: true });
	const [counts, setCounts] = useState<BrowserLibraryCounts | null>(null);
	const [summary, setSummary] = useState<BrowserImportSummary | null>(null);
	const [busy, setBusy] = useState(false);
	const [passwords, setPasswords] = useState<BrowserPasswordStatus | null>(null);
	const [passwordAdded, setPasswordAdded] = useState<number | null>(null);
	const host = (template: string): string => {
		try {
			return new URL(template).hostname.replace(/^www\./, '');
		} catch {
			return template;
		}
	};
	useEffect(() => {
		void window.browserPane.sources().then(setSources);
		void window.browserPane.library().then(setCounts);
		void window.browserPane.passwordsStatus().then(setPasswords);
	}, []);
	const chosen = (sources ?? []).filter((source) => !skipped.includes(source.id)).map((source) => source.id);
	const noKinds = !Object.values(kinds).some(Boolean);
	const run = async (work: () => Promise<BrowserImportSummary | null>): Promise<void> => {
		setBusy(true);
		try {
			const result = await work();
			if (result) setSummary(result);
			setCounts(await window.browserPane.library());
		} finally {
			setBusy(false);
		}
	};
	const pick = (folder: boolean): void => void run(() => window.browserPane.importPicked({ folder, ...kinds }));

	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.browser.title')} description={t('settings.browser.description')} />
			<SettingsPanel>
				<SettingsRow
					title={t('settings.browser.importTitle')}
					description={t('settings.browser.importDescription')}
					actionClassName="w-auto justify-end"
					actions={
						<Button
							type="button"
							disabled={busy || chosen.length === 0 || noKinds}
							onClick={() => void run(() => window.browserPane.importData({ sources: chosen, ...kinds }))}
						>
							{busy ? t('settings.browser.importing') : t('settings.browser.import')}
						</Button>
					}
				/>
				{sources === null ? <SettingsRow title={t('settings.browser.looking')} /> : null}
				{sources?.length === 0 ? <SettingsRow title={t('settings.browser.none')} /> : null}
				{sources?.map((source) => {
					const name = [source.app, source.profile].filter(Boolean).join(' — ');
					return (
						<SettingsRow
							key={source.id}
							title={name}
							description={[
								source.kinds.map((kind) => t(`settings.browser.${kind}`)).join(', '),
								t('settings.browser.used', { date: new Date(source.used).toLocaleDateString() }),
								source.folder,
							].join(' · ')}
							actionClassName="w-auto justify-end"
							actions={
								<Checkbox
									aria-label={name}
									checked={!skipped.includes(source.id)}
									onCheckedChange={(checked) =>
										setSkipped((current) =>
											checked ? current.filter((id) => id !== source.id) : [...current, source.id]
										)
									}
								/>
							}
						/>
					);
				})}
			</SettingsPanel>
			<SettingsPanel>
				<SettingsRow
					title={t('settings.browser.fromFile')}
					description={t('settings.browser.fromFileDescription')}
					actionClassName="w-auto justify-end gap-2"
					actions={
						PICKS_FILES_AND_FOLDERS_TOGETHER ? (
							<Button type="button" variant="outline" disabled={busy || noKinds} onClick={() => pick(false)}>
								{t('settings.browser.choose')}
							</Button>
						) : (
							<>
								<Button type="button" variant="outline" disabled={busy || noKinds} onClick={() => pick(false)}>
									{t('settings.browser.chooseFiles')}
								</Button>
								<Button type="button" variant="outline" disabled={busy || noKinds} onClick={() => pick(true)}>
									{t('settings.browser.chooseFolder')}
								</Button>
							</>
						)
					}
				/>
			</SettingsPanel>
			<SettingsPanel>
				{KINDS.map((kind) => (
					<SettingsRow
						key={kind}
						title={t(`settings.browser.${kind}`)}
						actionClassName="w-auto justify-end"
						actions={
							<Checkbox
								aria-label={t(`settings.browser.${kind}`)}
								checked={kinds[kind]}
								onCheckedChange={(checked) => setKinds((current) => ({ ...current, [kind]: checked === true }))}
							/>
						}
					/>
				))}
			</SettingsPanel>
			{summary ? (
				<SettingsNotice variant={summary.errors.length ? 'destructive' : 'default'}>
					{[
						t('settings.browser.done', { bookmarks: summary.bookmarks, history: summary.history }),
						summary.search ? t('settings.browser.searchSet', { host: host(summary.search) }) : '',
						...summary.errors,
					]
						.filter(Boolean)
						.join(' ')}
				</SettingsNotice>
			) : null}
			<SettingsPanel>
				<SettingsRow
					title={t('settings.browser.passwords')}
					description={
						passwords && !passwords.available
							? t('settings.browser.passwordsUnavailable')
							: t('settings.browser.passwordsDescription')
					}
					actionClassName="w-auto justify-end"
					actions={
						<Button
							type="button"
							variant="outline"
							disabled={busy || !passwords?.available}
							onClick={() =>
								void window.browserPane.passwordsImport().then((added) => {
									if (added !== null) setPasswordAdded(added);
									void window.browserPane.passwordsStatus().then(setPasswords);
								})
							}
						>
							{t('settings.browser.passwordsImport')}
						</Button>
					}
				/>
				{passwords && passwords.count > 0 ? (
					<Link to="/settings/browser/passwords" className="block hover:bg-muted/40">
						<SettingsRow
							title={t('settings.browser.passwordsStored', { count: passwords.count })}
							description={
								passwordAdded !== null
									? t('settings.browser.passwordsAdded', { count: passwordAdded })
									: t('settings.browser.passwordsPage.description')
							}
							className="grid-cols-[minmax(0,1fr)_auto]"
							actionClassName="w-auto justify-end"
							actions={<ChevronRight className="size-4 text-muted-foreground" />}
						/>
					</Link>
				) : null}
			</SettingsPanel>
			{counts ? (
				<SettingsPanel>
					{counts.bookmarks > 0 ? (
						<Link to="/settings/browser/bookmarks" className="block hover:bg-muted/40">
							<SettingsRow
								title={t('settings.browser.bookmarksPage.title')}
								description={t('settings.browser.bookmarksPage.count', { count: counts.bookmarks })}
								className="grid-cols-[minmax(0,1fr)_auto]"
								actionClassName="w-auto justify-end"
								actions={<ChevronRight className="size-4 text-muted-foreground" />}
							/>
						</Link>
					) : null}
					<SettingsRow
						title={t('settings.browser.stored')}
						description={t('settings.browser.storedDescription', {
							bookmarks: counts.bookmarks,
							history: counts.history,
							host: host(counts.search),
						})}
						actionClassName="w-auto justify-end"
						actions={
							<Button
								type="button"
								variant="outline"
								disabled={counts.bookmarks + counts.history === 0}
								onClick={() =>
									void window.browserPane
										.clearLibrary()
										.then(() => window.browserPane.library())
										.then((next) => {
											setCounts(next);
											setSummary(null);
										})
								}
							>
								{t('settings.browser.clear')}
							</Button>
						}
					/>
				</SettingsPanel>
			) : null}
		</SettingsPageShell>
	);
}
