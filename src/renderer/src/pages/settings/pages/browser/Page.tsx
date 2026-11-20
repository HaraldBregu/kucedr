import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
	BrowserImportSummary,
	BrowserLibraryCounts,
	BrowserSource,
} from '@shared/browser_import';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SettingsPageHeader, SettingsPageShell, SettingsPanel, SettingsRow } from '../../components';

const KINDS = ['bookmarks', 'history', 'settings'] as const;

export default function BrowserSettingsPage(): React.JSX.Element {
	const { t } = useTranslation();
	const [sources, setSources] = useState<BrowserSource[] | null>(null);
	const [chosen, setChosen] = useState<string[]>([]);
	const [kinds, setKinds] = useState({ bookmarks: true, history: true, settings: true });
	const [counts, setCounts] = useState<BrowserLibraryCounts | null>(null);
	const [summary, setSummary] = useState<BrowserImportSummary | null>(null);
	const [busy, setBusy] = useState(false);
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
	}, []);
	const run = async (): Promise<void> => {
		setBusy(true);
		try {
			setSummary(await window.browserPane.importData({ sources: chosen, ...kinds }));
			setCounts(await window.browserPane.library());
		} finally {
			setBusy(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader title={t('settings.browser.title')} description={t('settings.browser.description')} />
			<SettingsPanel>
				<SettingsRow title={t('settings.browser.importTitle')} description={t('settings.browser.importDescription')} />
				{sources?.length === 0 ? <SettingsRow title={t('settings.browser.none')} /> : null}
				{sources?.map((source) => (
					<SettingsRow
						key={source.id}
						title={source.browser}
						description={source.profile}
						actionClassName="w-auto justify-end"
						actions={
							<Checkbox
								aria-label={`${source.browser} ${source.profile}`}
								checked={chosen.includes(source.id)}
								onCheckedChange={(checked) =>
									setChosen((current) =>
										checked ? [...current, source.id] : current.filter((id) => id !== source.id)
									)
								}
							/>
						}
					/>
				))}
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
				<SettingsRow
					title={
						summary
							? t('settings.browser.done', { bookmarks: summary.bookmarks, history: summary.history })
							: ''
					}
					description={[
						summary?.search ? t('settings.browser.searchSet', { host: host(summary.search) }) : '',
						...(summary?.errors ?? []),
					]
						.filter(Boolean)
						.join(' ')}
					actionClassName="w-auto justify-end"
					actions={
						<Button
							type="button"
							disabled={busy || chosen.length === 0 || !Object.values(kinds).some(Boolean)}
							onClick={() => void run()}
						>
							{busy ? t('settings.browser.importing') : t('settings.browser.import')}
						</Button>
					}
				/>
			</SettingsPanel>
			{counts ? (
				<SettingsPanel>
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
