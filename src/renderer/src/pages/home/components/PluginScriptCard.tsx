import type { ReactElement } from 'react';
import { PluginScriptFrame } from '@/components/plugin-script/Frame';
import { Skeleton } from '@/components/ui/skeleton';
import { usePluginScripts } from '@/hooks/use-plugin-scripts';
import type { AgentToolPart } from '../context';
import { ToolActivityGroup } from './ToolActivityGroup';

export function PluginScriptCard({ tool }: { tool: AgentToolPart }): ReactElement {
	const { loaded, byName } = usePluginScripts();
	if (tool.state === 'output-error') return <ToolActivityGroup tools={[tool]} />;
	const call = tool.input as { name?: unknown; input?: unknown } | undefined;
	if (tool.state !== 'output-available' || !loaded || !call?.input)
		return <Skeleton className="h-64 w-full rounded-xl" />;
	const script = typeof call.name === 'string' ? byName.get(call.name) : undefined;
	if (!script) return <ToolActivityGroup tools={[tool]} />;
	return <PluginScriptFrame script={script} input={call.input} />;
}
