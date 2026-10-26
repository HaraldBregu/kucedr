import type { ReactElement } from 'react';
import { Chart } from '@/components/chart/Chart';
import { parseChart } from '@/components/chart/parse';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentToolPart } from '../context';
import { ToolActivityGroup } from './ToolActivityGroup';

export function ChartCard({ tool }: { tool: AgentToolPart }): ReactElement {
	if (tool.state === 'output-error') return <ToolActivityGroup tools={[tool]} />;
	const chart = tool.state === 'input-streaming' ? undefined : parseChart(tool.input);
	if (!chart) return <Skeleton className="h-64 w-full rounded-xl" />;
	return <Chart chart={chart} />;
}
