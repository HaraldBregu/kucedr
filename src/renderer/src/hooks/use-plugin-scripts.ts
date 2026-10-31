import { useEffect, useMemo, useState } from 'react';
import type { PluginScriptInfo } from '../../../shared/plugin_types';

let request: Promise<PluginScriptInfo[]> | undefined;

/** Enabled plugin scripts, looked up by name (chat) and by code-fence language (editor). */
export function usePluginScripts(): {
	loaded: boolean;
	byName: ReadonlyMap<string, PluginScriptInfo>;
	byFence: ReadonlyMap<string, PluginScriptInfo>;
} {
	const [scripts, setScripts] = useState<PluginScriptInfo[] | undefined>();
	useEffect(() => {
		let active = true;
		const load = (): void => {
			request ??= window.plugins
				.scripts()
				.then((scripts) => scripts.filter((script) => script.type === 'UI'));
			request.then(
				(next) => active && setScripts(next),
				() => active && setScripts([])
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
			loaded: scripts !== undefined,
			byName: new Map((scripts ?? []).map((script) => [script.name, script])),
			byFence: new Map(
				(scripts ?? []).flatMap((script) => (script.fence ? [[script.fence, script] as const] : []))
			),
		}),
		[scripts]
	);
}
