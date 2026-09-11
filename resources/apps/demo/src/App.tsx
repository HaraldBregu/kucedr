import { useEffect, useState, type CSSProperties } from 'react';
import { cva } from 'class-variance-authority';

import {
	app,
	isKucedr,
	isAppStoreValue,
	win,
	type AppLanguage,
	type AppTheme,
	type AppThemeColors,
	type AppThemeData,
} from '@kucedr/sdk';
import { cn } from './lib/utils';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import translations from './i18n.json';
import { runStorageTest } from './storage';

const fallbackColors: AppThemeColors = {
	radius: '0.625rem',
	'app-window-radius': '16px',
	'app-bg-opacity': '1',
	'app-surface-opacity': '1',
	'app-popover-opacity': '1',
	'app-sidebar-opacity': '1',
	'app-window-background-base': '#fbfbfa',
	'app-surface-background-base': '#ffffff',
	'app-popover-background-base': '#ffffff',
	'app-sidebar-background-base': '#fafaf8',
	'app-window-border': '#19635f',
	'app-window-background':
		'color-mix(in oklch, var(--app-window-background-base) calc(var(--app-bg-opacity) * 100%), transparent)',
	'app-surface-background':
		'color-mix(in oklch, var(--app-surface-background-base) calc(var(--app-surface-opacity) * 100%), transparent)',
	'app-popover-background':
		'color-mix(in oklch, var(--app-popover-background-base) calc(var(--app-popover-opacity) * 100%), transparent)',
	'app-sidebar-background':
		'color-mix(in oklch, var(--app-sidebar-background-base) calc(var(--app-sidebar-opacity) * 100%), transparent)',
	background: 'var(--app-window-background)',
	foreground: '#0e0e0e',
	card: 'var(--app-surface-background)',
	'card-foreground': '#0e0e0e',
	primary: '#0e0e0e',
	'primary-foreground': '#fbfbfa',
	secondary: '#eeede9',
	'secondary-foreground': '#0e0e0e',
	muted: '#eeede9',
	'muted-foreground': '#a3a7a7',
	accent: '#eae9e5',
	'accent-foreground': '#0e0e0e',
	border: 'color-mix(in oklch, #a3a7a7 45%, transparent)',
	input: 'color-mix(in oklch, #a3a7a7 45%, transparent)',
	ring: '#2b5fb1',
};
const fallbackTheme: AppThemeData = { themeMode: 'light', isDark: false, colors: fallbackColors };
const fallbackLanguage: AppLanguage = 'en';
const initialStorageKey = 'demo';
const initialStorageJson = '{\n  "label": "Kucedr demo",\n  "count": 1\n}';
const initialStoragePath = 'demo/message.txt';
const initialStorageFileContent = 'Saved by the Kucedr demo app.';
const themeBadgeClass = cva(
	'inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold',
	{
		variants: {
			variant: {
				light: 'border-border bg-secondary text-secondary-foreground',
				dark: 'border-border bg-secondary text-secondary-foreground',
			},
		},
		defaultVariants: {
			variant: 'light',
		},
	}
);

export default function App() {
	const [theme, setTheme] = useState<AppThemeData>(fallbackTheme);
	const [language, setLanguage] = useState<AppLanguage>(fallbackLanguage);
	const [status, setStatus] = useState(translations.en.waiting);
	const [storageKey, setStorageKey] = useState(initialStorageKey);
	const [storageJson, setStorageJson] = useState(initialStorageJson);
	const [appStoreValue, setAppStoreValue] = useState('');
	const [storagePath, setStoragePath] = useState(initialStoragePath);
	const [storageFileContent, setStorageFileContent] = useState(initialStorageFileContent);
	const [appFileValue, setAppFileValue] = useState('');
	const [storageTestResults, setStorageTestResults] = useState<string[]>([]);
	const [storageBusy, setStorageBusy] = useState(false);
	const inKucedrApp = isKucedr();
	const text = translations[language] ?? translations.en;
	const themeStyle = Object.fromEntries(
		Object.entries(theme.colors).map(([name, value]) => [`--${name}`, value])
	) as CSSProperties;

	useEffect(() => {
		if (!isKucedr()) return;
		win.setTitlebarOptions({ title: 'Demo', leftButtons: [], rightButtons: [] });
		return () => win.setTitlebarOptions(null);
	}, []);

	const ensureKucedrApp = () => {
		if (!isKucedr()) {
			setStatus(text.runtimeMissing);
			return false;
		}
		return true;
	};

	const getStatusText = (themeData: AppThemeData, appLanguage: AppLanguage): string => {
		return `theme=${themeData.themeMode}, resolved-dark=${String(themeData.isDark)}, language=${appLanguage}`;
	};

	const refreshTheme = async () => {
		if (!ensureKucedrApp()) return;
		try {
			const themeData = await app.getThemeData();
			setTheme(themeData);
			setStatus(`${text.themeRefreshed} (${getStatusText(themeData, language)})`);
		} catch {
			setStatus(text.themeRefreshFailed);
		}
	};

	const refreshLanguage = async () => {
		if (!ensureKucedrApp()) return;
		try {
			const appLanguage = await app.getLanguage();
			setLanguage(appLanguage);
			setStatus(
				`${translations[appLanguage].languageRefreshed} (${getStatusText(theme, appLanguage)})`
			);
		} catch {
			setStatus(text.languageRefreshFailed);
		}
	};

	const setAppTheme = async (nextTheme: AppTheme) => {
		if (!ensureKucedrApp()) return;
		try {
			await app.setTheme(nextTheme);
			await refreshTheme();
			setStatus(`${text.themeSet} ${nextTheme}`);
		} catch {
			setStatus(text.themeSetFailed);
		}
	};

	const setAppLanguage = async (nextLanguage: AppLanguage) => {
		if (!ensureKucedrApp()) return;
		try {
			await app.setLanguage(nextLanguage);
			await refreshLanguage();
			setStatus(`${translations[nextLanguage].languageSet} ${nextLanguage}`);
		} catch {
			setStatus(text.languageSetFailed);
		}
	};

	const printThemeData = async () => {
		if (!ensureKucedrApp()) return;
		try {
			const themeData = await app.getThemeData();
			setTheme(themeData);
			console.log('Kucedr app theme data', themeData);
			setStatus(text.printThemeDataSuccess);
		} catch {
			setStatus(text.printThemeDataFailed);
		}
	};

	const runStorageAction = async (action: () => Promise<string>) => {
		if (!ensureKucedrApp()) return;
		setStorageBusy(true);
		try {
			setStatus(await action());
		} catch (error) {
			setStatus(
				`${text.storageActionFailed}: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			setStorageBusy(false);
		}
	};

	const storeAppValue = () =>
		runStorageAction(async () => {
			const key = storageKey.trim();
			if (!key) throw new Error(text.storageKeyRequired);
			let value: unknown;
			try {
				value = JSON.parse(storageJson);
			} catch {
				throw new Error(text.storageJsonInvalid);
			}
			if (!isAppStoreValue(value)) throw new Error(text.storageValueInvalid);
			await app.setAppStoreValue(key, value);
			setAppStoreValue(JSON.stringify(value, null, 2));
			return text.storageValueStored;
		});

	const loadAppValue = () =>
		runStorageAction(async () => {
			const key = storageKey.trim();
			if (!key) throw new Error(text.storageKeyRequired);
			const value = await app.getAppStoreValue(key);
			const formattedValue = value === undefined ? '' : JSON.stringify(value, null, 2);
			setAppStoreValue(formattedValue);
			if (formattedValue) setStorageJson(formattedValue);
			return value === undefined ? text.storageValueMissing : text.storageValueLoaded;
		});

	const deleteAppValue = () =>
		runStorageAction(async () => {
			const key = storageKey.trim();
			if (!key) throw new Error(text.storageKeyRequired);
			await app.deleteAppStoreValue(key);
			setAppStoreValue('');
			return text.storageValueDeleted;
		});

	const saveAppFile = () =>
		runStorageAction(async () => {
			const path = storagePath.trim();
			if (!path) throw new Error(text.storagePathRequired);
			await app.writeAppStoreFile(path, new TextEncoder().encode(storageFileContent));
			setAppFileValue(storageFileContent);
			return text.storageFileSaved;
		});

	const readAppFile = () =>
		runStorageAction(async () => {
			const path = storagePath.trim();
			if (!path) throw new Error(text.storagePathRequired);
			const value = new TextDecoder().decode(await app.readAppStoreFile(path));
			setStorageFileContent(value);
			setAppFileValue(value);
			return text.storageFileLoaded;
		});

	const deleteAppFile = () =>
		runStorageAction(async () => {
			const path = storagePath.trim();
			if (!path) throw new Error(text.storagePathRequired);
			await app.deleteAppStoreFile(path);
			setAppFileValue('');
			return text.storageFileDeleted;
		});

	const runCompleteStorageTest = () => {
		setStorageTestResults([]);
		void runStorageAction(async () => {
			setStorageTestResults(await runStorageTest());
			return text.storageTestPassed;
		});
	};

	useEffect(() => {
		if (!isKucedr()) return;

		let mounted = true;
		const loadCurrentState = async () => {
			try {
				const [themeData, appLanguage] = await Promise.all([app.getThemeData(), app.getLanguage()]);
				if (!mounted) return;
				setTheme(themeData);
				setLanguage(appLanguage);
				setStatus(`${translations[appLanguage].loaded} (${getStatusText(themeData, appLanguage)})`);
			} catch {
				if (mounted) setStatus(text.loadFailed);
			}
		};
		void loadCurrentState();
		const unsubscribe = app.onThemeModeChanged((themeData) => {
			if (!mounted) return;
			setTheme(themeData);
			setStatus(`${text.themeChanged} (${getStatusText(themeData, language)})`);
		});

		return () => {
			mounted = false;
			unsubscribe();
		};
	}, [language, text.loadFailed, text.themeChanged]);

	return (
		<main className={cn('app-demo overflow-y-auto', theme.isDark && 'dark')} style={themeStyle}>
			<div className="min-h-full w-full">
				<div className="min-h-full w-full space-y-5 border border-border bg-card p-6 text-card-foreground shadow-sm">
					<p className="text-lg font-semibold">{text.title}</p>
					<p className="text-sm text-muted-foreground">
						{inKucedrApp ? text.connected : text.disconnected}
					</p>
					<div className="space-y-2">
						<p className="text-sm font-semibold">{text.theme}</p>
						<p className="text-sm">
							{text.themeMode}: {theme.themeMode}
						</p>
						<p className="text-sm">
							{text.resolvedDarkMode}: {theme.isDark ? 'true' : 'false'}
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<Button variant="outline" onClick={() => setAppTheme('light')}>
								{text.setLight}
							</Button>
							<Button variant="outline" onClick={() => setAppTheme('dark')}>
								{text.setDark}
							</Button>
							<Button variant="outline" onClick={() => setAppTheme('system')}>
								{text.setSystem}
							</Button>
							<Button variant="secondary" onClick={refreshTheme}>
								{text.getTheme}
							</Button>
							<Button onClick={printThemeData}>{text.printThemeData}</Button>
						</div>
					</div>
					<div className="space-y-2">
						<p className="text-sm font-semibold">{text.language}</p>
						<p className="text-sm">
							{text.currentLanguage}: {language}
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<Button variant="outline" onClick={() => setAppLanguage('en')}>
								{text.setEnglish}
							</Button>
							<Button variant="outline" onClick={() => setAppLanguage('it')}>
								{text.setItalian}
							</Button>
							<Button variant="secondary" onClick={refreshLanguage}>
								{text.getLanguage}
							</Button>
						</div>
					</div>
					<div className="space-y-4 border-t border-border pt-4">
						<p className="text-sm font-semibold">{text.storage}</p>
						<p className="text-sm text-muted-foreground">{text.storageDescription}</p>
						<div className="space-y-3 rounded-md border border-border p-4">
							<p className="text-sm font-semibold">{text.storageValue}</p>
							<label className="block space-y-1 text-sm" htmlFor="storage-key">
								<span>{text.storageKey}</span>
								<Input
									id="storage-key"
									value={storageKey}
									disabled={storageBusy}
									onChange={(event) => setStorageKey(event.target.value)}
								/>
							</label>
							<label className="block space-y-1 text-sm" htmlFor="storage-json">
								<span>{text.storageJson}</span>
								<Textarea
									id="storage-json"
									value={storageJson}
									disabled={storageBusy}
									className="font-mono"
									onChange={(event) => setStorageJson(event.target.value)}
								/>
							</label>
							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									disabled={storageBusy}
									onClick={storeAppValue}
								>
									{text.storeStorageValue}
								</Button>
								<Button
									size="sm"
									variant="secondary"
									disabled={storageBusy}
									onClick={loadAppValue}
								>
									{text.loadStorageValue}
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={storageBusy}
									onClick={deleteAppValue}
								>
									{text.deleteStorageValue}
								</Button>
							</div>
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">{text.storageResult}</p>
								<pre className="max-h-36 min-h-10 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
									{appStoreValue || text.storageEmpty}
								</pre>
							</div>
						</div>
						<div className="space-y-3 rounded-md border border-border p-4">
							<p className="text-sm font-semibold">{text.storageFile}</p>
							<label className="block space-y-1 text-sm" htmlFor="storage-path">
								<span>{text.storagePath}</span>
								<Input
									id="storage-path"
									value={storagePath}
									disabled={storageBusy}
									onChange={(event) => setStoragePath(event.target.value)}
								/>
							</label>
							<label className="block space-y-1 text-sm" htmlFor="storage-file-content">
								<span>{text.storageFileContent}</span>
								<Textarea
									id="storage-file-content"
									value={storageFileContent}
									disabled={storageBusy}
									onChange={(event) => setStorageFileContent(event.target.value)}
								/>
							</label>
							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									disabled={storageBusy}
									onClick={saveAppFile}
								>
									{text.saveStorageFile}
								</Button>
								<Button
									size="sm"
									variant="secondary"
									disabled={storageBusy}
									onClick={readAppFile}
								>
									{text.readStorageFile}
								</Button>
								<Button
									size="sm"
									variant="destructive"
									disabled={storageBusy}
									onClick={deleteAppFile}
								>
									{text.deleteStorageFile}
								</Button>
							</div>
							<div className="space-y-1">
								<p className="text-xs font-medium text-muted-foreground">{text.storageResult}</p>
								<pre className="max-h-36 min-h-10 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
									{appFileValue || text.storageEmpty}
								</pre>
							</div>
						</div>
						<div className="space-y-3 rounded-md border border-border p-4">
							<div>
								<p className="text-sm font-semibold">{text.storageTest}</p>
								<p className="mt-1 text-sm text-muted-foreground">{text.storageTestDescription}</p>
							</div>
							<Button disabled={storageBusy} onClick={runCompleteStorageTest}>
								{text.runStorageTest}
							</Button>
							{storageTestResults.length > 0 && (
								<ul className="space-y-1 text-xs" aria-label={text.storageTestResults}>
									{storageTestResults.map((result) => (
										<li key={result}>✓ {result}</li>
									))}
								</ul>
							)}
						</div>
					</div>
					<p className="text-sm text-muted-foreground">
						{text.status}: {status}
					</p>
					<span className={themeBadgeClass({ variant: theme.isDark ? 'dark' : 'light' })}>
						{theme.isDark ? text.dark : text.light}
					</span>
				</div>
			</div>
		</main>
	);
}
