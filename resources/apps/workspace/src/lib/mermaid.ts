import mermaid from 'mermaid';

import { mermaidPluginsReady } from './plugins';

let renderId = 0;
let queue = Promise.resolve();

export function renderMermaid(source: string, isDark: boolean) {
	const job = queue.then(async () => {
		await mermaidPluginsReady;
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict',
			suppressErrorRendering: true,
			theme: isDark ? 'dark' : 'default',
		});
		await mermaid.parse(source);
		return mermaid.render(`kucedr-workspace-mermaid-${++renderId}`, source);
	});
	queue = job.then(
		() => undefined,
		() => undefined
	);
	return job;
}
