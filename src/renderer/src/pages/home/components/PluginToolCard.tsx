import type { ReactElement } from 'react';
import { PluginToolFrame } from '@/components/plugin-tool/Frame';
import { Skeleton } from '@/components/ui/skeleton';
import { usePluginTools } from '@/hooks/use-plugin-tools';
import type { AgentToolPart } from '../context';
import { ToolActivityGroup } from './ToolActivityGroup';

export function PluginToolCard({ tool }: { tool: AgentToolPart }): ReactElement {
	const { loaded, byName } = usePluginTools();
	if (tool.state === 'output-error') return <ToolActivityGroup tools={[tool]} />;
	const call = tool.input as { name?: unknown; input?: unknown } | undefined;
	if (tool.state === 'input-streaming' || !loaded || !call?.input)
		return <Skeleton className="h-64 w-full rounded-xl" />;
	const pluginTool = typeof call.name === 'string' ? byName.get(call.name) : undefined;
	if (!pluginTool) return <ToolActivityGroup tools={[tool]} />;
	return <PluginToolFrame tool={pluginTool} input={call.input} />;
}
