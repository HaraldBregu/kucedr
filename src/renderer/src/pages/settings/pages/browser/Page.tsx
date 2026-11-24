import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { BrowserConnections } from '@shared/browser';
import type {
	BrowserImportSummary,
	BrowserLibraryCounts,
	BrowserPasswordStatus,
	BrowserSource,
} from '@shared/browser_import';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
	const { hash } = useLocation();
	const connectionsRow = useRef<HTMLSpanElement>(null);
	const [sources, setSources] = useState<BrowserSource[] | null>(null);
	const [skipped, setSkipped] = useState<string[]>([]);
	const [kinds, setKinds] = useState({ bookmarks: true, history: true, settings: true });
	const [counts, setCounts] = useState<BrowserLibraryCounts | null>(null);
	const [summary, setSummary] = useState<BrowserImportSummary | null>(null);
	const [busy, setBusy] = useState(false);
	const [passwords, setPasswords] = useState<BrowserPasswordStatus | null>(null);
	const [passwordAdded, setPasswordAdded] = useState<number | null>(null);
	const [routes, setRoutes] = useState<BrowserConnections | null>(null);
	const [torFound, setTorFound] = useState<string | null | undefined>(undefined);
	const [routesNotice, setRoutesNotice] = useState<{ readonly error: boolean; readonly text: string } | null>(null);
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
		void window.browserPane.connections().then(setRoutes);
	}, []);
	const connectionsLoaded = routes !== null;
	useEffect(() => {
		if (connectionsLoaded && hash === '#connections') {
			connectionsRow.current?.scrollIntoView({ block: 'start' });
		}
	}, [connectionsLoaded, hash]);
	const saveRoutes = async (): Promise<boolean> => {
		if (!routes) return false;
		try {
			await window.browserPane.connectionsSet(routes);
			setRoutesNotice({ error: false, text: t('settings.browser.connections.saved') });
			return true;
		} catch (cause) {
			setRoutesNotice({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
			return false;
		}
	};
	const checkTor = async (): Promise<void> => {
		if (!(await saveRoutes())) return;
		setRoutesNotice(null);
		try {
			setTorFound(await window.browserPane.torFind());
		} catch (cause) {
			setRoutesNotice({ error: true, text: cause instanceof Error ? cause.message : String(cause) });
		}
	};
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
	const clear = async (work: () => Promise<boolean>): Promise<void> => {
		if (!(await work())) return;
		setCounts(await window.browserPane.library());
		setSummary(null);
	};

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
					{counts.history > 0 ? (
						<Link to="/settings/browser/history" className="block hover:bg-muted/40">
							<SettingsRow
								title={t('settings.browser.historyPage.title')}
								description={t('settings.browser.historyPage.count', { count: counts.history })}
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
						actionClassName="w-auto justify-end gap-2"
						actions={
							<>
								<Button
									type="button"
									variant="outline"
									disabled={counts.history === 0}
									onClick={() => void clear(() => window.browserPane.historyClear())}
								>
									{t('settings.browser.clearHistory')}
								</Button>
								<Button
									type="button"
									variant="outline"
									disabled={counts.bookmarks === 0}
									onClick={() => void clear(() => window.browserPane.bookmarksClear())}
								>
									{t('settings.browser.deleteBookmarks')}
								</Button>
							</>
						}
					/>
				</SettingsPanel>
			) : null}
			{routes ? (
				<SettingsPanel>
					<SettingsRow
						title={
							<span ref={connectionsRow} className="block scroll-mt-14">
								{t('settings.browser.connections.title')}
							</span>
						}
						description={t('settings.browser.connections.description')}
					/>
					<SettingsRow
						title={t('settings.browser.connections.tor')}
						description={
							torFound === undefined
								? t('settings.browser.connections.torDescription')
								: torFound
									? t('settings.browser.connections.torFound', { address: torFound })
									: t('settings.browser.connections.torMissing')
						}
						actionClassName="w-auto justify-end gap-2"
						actions={
							<>
								<Input
									aria-label={t('settings.browser.connections.tor')}
									autoComplete="off"
									spellCheck={false}
									className="h-8 w-44 text-xs"
									placeholder={t('settings.browser.connections.automatic')}
									value={routes.tor}
									onChange={(event) => setRoutes({ ...routes, tor: event.target.value })}
								/>
								<Button type="button" variant="outline" onClick={() => void checkTor()}>
									{t('settings.browser.connections.check')}
								</Button>
							</>
						}
					/>
					<SettingsRow
						title={t('settings.browser.connections.proxy')}
						description={t('settings.browser.connections.proxyDescription')}
						actionClassName="w-auto justify-end"
						actions={
							<Input
								aria-label={t('settings.browser.connections.proxy')}
								autoComplete="off"
								spellCheck={false}
								className="h-8 w-56 text-xs"
								placeholder="socks5://127.0.0.1:1080"
								value={routes.proxy}
								onChange={(event) => setRoutes({ ...routes, proxy: event.target.value })}
							/>
						}
					/>
					<SettingsRow
						title={t('settings.browser.connections.limits')}
						description={t('settings.browser.connections.limitsDescription')}
						actionClassName="w-auto justify-end"
						actions={
							<Button type="button" onClick={() => void saveRoutes()}>
								{t('settings.browser.connections.save')}
							</Button>
						}
					/>
				</SettingsPanel>
			) : null}
			{routesNotice ? (
				<SettingsNotice variant={routesNotice.error ? 'destructive' : 'default'}>{routesNotice.text}</SettingsNotice>
			) : null}
		</SettingsPageShell>
	);
}
