import { useEffect, useMemo, useState } from 'react';
import type { PluginToolInfo } from '../../../shared/plugin_types';

let request: Promise<PluginToolInfo[]> | undefined;

/** Enabled plugin tools, looked up by name (chat) and by code-fence language (editor). */
export function usePluginTools(): {
	loaded: boolean;
	byName: ReadonlyMap<string, PluginToolInfo>;
	byFence: ReadonlyMap<string, PluginToolInfo>;
} {
	const [tools, setTools] = useState<PluginToolInfo[] | undefined>();
	useEffect(() => {
		let active = true;
		const load = (): void => {
			request ??= window.plugins.tools();
			request.then(
				(next) => active && setTools(next),
				() => active && setTools([])
			);
		};
		load();
		const unsubscribe = window.app.onModelsChanged(() => {
			request = undefined;
			load();
		});
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);
	return useMemo(
		() => ({
			loaded: tools !== undefined,
			byName: new Map((tools ?? []).map((tool) => [tool.name, tool])),
			byFence: new Map(
				(tools ?? []).flatMap((tool) => (tool.fence ? [[tool.fence, tool] as const] : []))
			),
		}),
		[tools]
	);
}
