import { useEffect, useState, type ReactElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { app, type AppThemeData } from '@kucedr/sdk';
import type { PluginToolInfo } from '../../../../shared/plugin_types';
import { pluginToolDocument } from './document';

/** Renders a plugin tool's HTML in a sandboxed frame with no network access. */
export function PluginToolFrame({
	tool,
	input,
}: {
	tool: PluginToolInfo;
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
		window.plugins.renderTool(tool.name, JSON.parse(key), theme.isDark ? 'dark' : 'light').then(
			(html) => active && setResult({ html: pluginToolDocument(html, theme) }),
			(error: unknown) =>
				active && setResult({ error: error instanceof Error ? error.message : String(error) })
		);
		return () => {
			active = false;
		};
	}, [tool.name, key, theme]);

	if (result.error) return <p className="text-xs text-destructive">{result.error}</p>;
	if (!result.html)
		return <Skeleton className="w-full rounded-xl" style={{ height: tool.height }} />;
	return (
		<iframe
			title={tool.title}
			sandbox="allow-scripts"
			srcDoc={result.html}
			className="w-full rounded-xl border border-border"
			style={{ height: tool.height }}
		/>
	);
}
