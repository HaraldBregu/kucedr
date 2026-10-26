import { useEffect, useState, type ReactElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { app, type AppThemeData } from '@kucedr/sdk';
import type { PluginScriptInfo } from '../../../../shared/plugin_types';
import { pluginScriptDocument } from './document';

/** Renders a plugin script's HTML in a sandboxed frame with no network access. */
export function PluginScriptFrame({
	script,
	input,
}: {
	script: PluginScriptInfo;
	input: unknown;
}): ReactElement {
	const [theme, setTheme] = useState<AppThemeData>();
	const key = JSON.stringify(input);
	const [result, setResult] = useState<{ html?: string; error?: string }>({});
	useEffect(() => {
		let active = true;
		const update = (next: AppThemeData): void => {
			if (active) setTheme(next);
		};
		void app.getThemeData().then(update, (error: unknown) => {
			if (active) setResult({ error: error instanceof Error ? error.message : String(error) });
		});
		const unsubscribe = app.onThemeModeChanged(update);
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);
	useEffect(() => {
		if (!theme) return;
		let active = true;
		window.plugins.renderScript(script.name, JSON.parse(key), theme.isDark ? 'dark' : 'light').then(
			(html) => active && setResult({ html: pluginScriptDocument(html, theme) }),
			(error: unknown) =>
				active && setResult({ error: error instanceof Error ? error.message : String(error) })
		);
		return () => {
			active = false;
		};
	}, [script.name, key, theme]);

	if (result.error) return <p className="text-xs text-destructive">{result.error}</p>;
	if (!result.html)
		return <Skeleton className="w-full rounded-xl" style={{ height: script.height }} />;
	return (
		<iframe
			title={script.title}
			sandbox="allow-scripts"
			srcDoc={result.html}
			className="w-full border-0"
			style={{ height: script.height }}
		/>
	);
}
