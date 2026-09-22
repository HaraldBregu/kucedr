import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
	ArrowUpRight,
	BarChart3,
	Bookmark,
	Copy,
	Globe2,
	LoaderCircle,
	Minus,
	Search,
	Sparkles,
	Square,
	TrendingUp,
	X,
} from 'lucide-react';

import { agent, app, isKucedr, win, type AppLanguage, type AppThemeData } from '@kucedr/sdk';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import { cn } from './lib/utils';

const fallbackTheme: AppThemeData = { themeMode: 'light', isDark: false, colors: {} };
const topics = [
	{ label: 'AI infrastructure', detail: 'Compute, chips, and platforms', icon: Sparkles },
	{ label: 'Climate adaptation', detail: 'Resilience and urban systems', icon: Globe2 },
	{ label: 'Consumer shifts', detail: 'Spending and attention', icon: TrendingUp },
];
const signals = [
	{ title: 'Demand signal', detail: 'Track the vocabulary, buyers, and recurring use cases around the topic.', icon: TrendingUp },
	{ title: 'Market map', detail: 'Identify the ecosystem, adjacent categories, and the assumptions shaping it.', icon: BarChart3 },
	{ title: 'Research angle', detail: 'Compare what is established with the questions still worth validating.', icon: Search },
];
const copy = {
	en: {
		title: 'Discover', placeholder: 'What would you like to understand?', explore: 'Explore', newResearch: 'New research', recent: 'Research directions', overview: 'Overview', saved: 'Saved', markets: 'Markets', trends: 'Trends', headline: 'Start with a question worth following.', subhead: 'Discover turns an open question into a focused research brief with trend, market, and evidence prompts.', brief: 'Discovery brief', briefIdle: 'Ask a question to create a focused research brief.', briefWorking: 'Researching your question…', briefError: 'Discover could not reach the research agent. Check your Kucedr connection and try again.', live: 'Research with Kucedr AI', offline: 'Open Discover in Kucedr to run research', results: 'What to investigate', signal: 'Signal',
	},
	it: {
		title: 'Discover', placeholder: 'Cosa vuoi capire?', explore: 'Esplora', newResearch: 'Nuova ricerca', recent: 'Direzioni di ricerca', overview: 'Panoramica', saved: 'Salvati', markets: 'Mercati', trends: 'Trend', headline: 'Inizia da una domanda che vale la pena seguire.', subhead: 'Discover trasforma una domanda aperta in un brief di ricerca mirato, con spunti su trend, mercato ed evidenze.', brief: 'Brief di scoperta', briefIdle: 'Fai una domanda per creare un brief di ricerca mirato.', briefWorking: 'Ricerca della tua domanda in corso…', briefError: 'Discover non riesce a contattare l’agente di ricerca. Controlla la connessione Kucedr e riprova.', live: 'Ricerca con Kucedr AI', offline: 'Apri Discover in Kucedr per avviare la ricerca', results: 'Cosa indagare', signal: 'Segnale',
	},
} as const;
const isMac = typeof navigator !== 'undefined' && (navigator.platform === 'MacIntel' || navigator.platform.startsWith('Mac'));

export default function App() {
	const [theme, setTheme] = useState<AppThemeData>(fallbackTheme);
	const [language, setLanguage] = useState<AppLanguage>('en');
	const [query, setQuery] = useState('');
	const [brief, setBrief] = useState('');
	const [researching, setResearching] = useState(false);
	const [researchError, setResearchError] = useState(false);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [maximized, setMaximized] = useState(false);
	const inKucedrApp = isKucedr();
	const text = copy[language] ?? copy.en;
	const themeStyle = Object.fromEntries(Object.entries(theme.colors).map(([name, value]) => [`--${name}`, value])) as CSSProperties;

	useEffect(() => {
		if (!inKucedrApp) return;
		let active = true;
		void Promise.all([app.getThemeData(), app.getLanguage()]).then(([themeData, appLanguage]) => {
			if (!active) return;
			setTheme(themeData);
			setLanguage(appLanguage);
		}).catch(() => undefined);
		const unsubscribe = app.onThemeModeChanged((nextTheme) => { if (active) setTheme(nextTheme); });
		return () => { active = false; unsubscribe(); };
	}, [inKucedrApp]);

	useEffect(() => {
		if (!inKucedrApp) return;
		void win.isMaximized().then(setMaximized);
		return win.onMaximizeChange(setMaximized);
	}, [inKucedrApp]);

	const runResearch = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const question = query.trim();
		if (!question || !inKucedrApp || researching) return;
		setResearching(true);
		setResearchError(false);
		setBrief('');
		try {
			const result = await agent.send(`Create a concise discovery brief for this research question: ${question}\n\nInclude: the emerging trend or market context, the most important signals to validate, notable players or segments, and 3 next research questions. When current information matters, use web research and cite sources. Be precise and practical.`, { contextMode: 'minimal', toolsAllow: ['web_search'] });
			setBrief(result);
		} catch {
			setResearchError(true);
		} finally {
			setResearching(false);
		}
	};

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className={cn('app-discover flex min-h-0', theme.isDark && 'dark')} style={themeStyle}>
			<Sidebar aria-label={text.title}>
				<div className="h-12 shrink-0 border-b border-border" style={{ WebkitAppRegion: 'drag' } as CSSProperties} />
				<div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold"><div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles className="size-3.5" /></div>{text.title}</div>
				<SidebarContent className="p-2">
					<Button variant="secondary" className="mb-4 w-full justify-start gap-2" onClick={() => { setQuery(''); setBrief(''); setResearchError(false); }}><Search className="size-4" />{text.newResearch}</Button>
					<nav className="space-y-1" aria-label={text.title}>{[text.overview, text.trends, text.markets, text.saved].map((item, index) => <button key={item} type="button" className={cn('flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-muted', index === 0 && 'bg-muted font-medium')}>{item}</button>)}</nav>
					<div className="mt-6 px-2"><p className="mb-2 text-xs font-medium text-muted-foreground">{text.recent}</p><div className="space-y-1">{topics.map(({ label }) => <button key={label} type="button" className="w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setQuery(label)}>{label}</button>)}</div></div>
				</SidebarContent>
			</Sidebar>
			<SidebarInset>
				<header className={cn('flex h-12 shrink-0 items-center border-b border-border bg-card pl-3', !sidebarOpen && 'pl-28')} style={{ WebkitAppRegion: 'drag' } as CSSProperties}>
					<SidebarTrigger isDark={theme.isDark} style={{ WebkitAppRegion: 'no-drag' } as CSSProperties} />
					<p className="text-sm font-medium">{text.title}</p><div className="min-w-0 flex-1" />
					<span className="mr-3 flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('size-1.5 rounded-full', inKucedrApp ? 'bg-emerald-500' : 'bg-muted-foreground')} />{inKucedrApp ? text.live : text.offline}</span>
					{!isMac && inKucedrApp ? <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}><button type="button" className="flex h-full w-[46px] items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground" title="Minimize window" aria-label="Minimize window" onClick={win.minimize}><Minus className="size-3.5" strokeWidth={1.5} /></button><button type="button" className="flex h-full w-[46px] items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground" title={maximized ? 'Restore window' : 'Maximize window'} aria-label={maximized ? 'Restore window' : 'Maximize window'} onClick={win.maximize}>{maximized ? <Copy className="size-3.5" strokeWidth={1.5} /> : <Square className="size-3.5" strokeWidth={1.5} />}</button><button type="button" className="flex h-full w-[46px] items-center justify-center text-muted-foreground hover:bg-red-600 hover:text-white" title="Close window" aria-label="Close window" onClick={win.close}><X className="size-3.5" strokeWidth={1.5} /></button></div> : null}
				</header>
				<main className="min-h-0 flex-1 overflow-y-auto bg-background"><div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-12">
					<section className="max-w-3xl space-y-4"><div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"><Sparkles className="size-3.5" />{text.title}</div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{text.headline}</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">{text.subhead}</p><form className="flex gap-2 pt-2" onSubmit={runResearch}><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.placeholder} aria-label={text.placeholder} className="h-11 bg-card" /><Button type="submit" disabled={!query.trim() || researching || !inKucedrApp} className="h-11 gap-2 px-5"><ArrowUpRight className="size-4" />{text.explore}</Button></form></section>
					<section className="grid gap-3 md:grid-cols-3">{topics.map(({ label, detail, icon: Icon }) => <button key={label} type="button" className="group rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted" onClick={() => setQuery(label)}><Icon className="mb-8 size-5 text-muted-foreground" strokeWidth={1.5} /><p className="font-medium">{label}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></button>)}</section>
					<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="rounded-xl border border-border bg-card p-6"><div className="flex items-center justify-between gap-4"><div><p className="font-medium">{text.brief}</p><p className="mt-1 text-sm text-muted-foreground">{query || text.briefIdle}</p></div><Bookmark className="size-4 text-muted-foreground" /></div><div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-foreground">{researching ? <span className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{text.briefWorking}</span> : researchError ? <span className="text-red-600">{text.briefError}</span> : brief || <span className="text-muted-foreground">{text.briefIdle}</span>}</div></div><aside className="rounded-xl border border-border bg-card p-5"><p className="text-sm font-medium">{text.results}</p><div className="mt-4 space-y-5">{signals.map(({ title, detail, icon: Icon }) => <div key={title}><div className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-muted-foreground" />{title}</div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p></div>)}</div><p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">{text.signal}: frame the question before committing to a conclusion.</p></aside></section>
				</div></main>
			</SidebarInset>
		</SidebarProvider>
	);
}
