import { useEffect, useState, type ReactElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsDark } from '@/hooks/use-is-dark';
import type { PluginToolInfo } from '../../../../shared/plugin_types';

const CSP =
	'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:">';

function withCsp(html: string): string {
	return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => head + CSP) : CSP + html;
}

/** Renders a plugin tool's HTML in a sandboxed frame with no network access. */
export function PluginToolFrame({
	tool,
	input,
}: {
	tool: PluginToolInfo;
	input: unknown;
}): ReactElement {
	const isDark = useIsDark();
	const key = JSON.stringify(input);
	const [result, setResult] = useState<{ html?: string; error?: string }>({});
	useEffect(() => {
		let active = true;
		window.plugins.renderTool(tool.name, JSON.parse(key), isDark ? 'dark' : 'light').then(
			(html) => active && setResult({ html: withCsp(html) }),
			(error: unknown) =>
				active && setResult({ error: error instanceof Error ? error.message : String(error) })
		);
		return () => {
			active = false;
		};
	}, [tool.name, key, isDark]);

	if (result.error) return <p className="text-xs text-destructive">{result.error}</p>;
	if (!result.html) return <Skeleton className="w-full rounded-xl" style={{ height: tool.height }} />;
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
