import type { ReactElement } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentToolPart } from '../context';
import { ToolActivityGroup } from './ToolActivityGroup';

type ChartInput = {
	type: 'bar' | 'line' | 'area' | 'pie';
	title: string;
	description?: string;
	data: Record<string, string | number>[];
	xKey: string;
	series: { key: string; label: string }[];
};

function chartInput(tool: AgentToolPart): ChartInput | undefined {
	const input = tool.input as Partial<ChartInput> | undefined;
	if (!input || !Array.isArray(input.data) || !Array.isArray(input.series) || !input.xKey) return undefined;
	if (!['bar', 'line', 'area', 'pie'].includes(input.type ?? '')) return undefined;
	return input as ChartInput;
}

const color = (index: number): string => `var(--chart-${(index % 5) + 1})`;

function renderChart({ type, data, xKey, series }: ChartInput): ReactElement {
	if (type === 'pie') {
		const key = series[0].key;
		return (
			<PieChart>
				<ChartTooltip content={<ChartTooltipContent nameKey={xKey} hideLabel />} />
				<Pie data={data} dataKey={key} nameKey={xKey}>
					{data.map((row, index) => (
						<Cell key={String(row[xKey])} fill={color(index)} />
					))}
				</Pie>
				<ChartLegend content={<ChartLegendContent nameKey={xKey} />} />
			</PieChart>
		);
	}
	const axes = [
		<CartesianGrid key="grid" vertical={false} />,
		<XAxis key="x" dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />,
		<YAxis key="y" tickLine={false} axisLine={false} width={40} />,
		<ChartTooltip key="tooltip" content={<ChartTooltipContent />} />,
		<ChartLegend key="legend" content={<ChartLegendContent />} />,
	];
	if (type === 'line')
		return (
			<LineChart data={data}>
				{axes}
				{series.map(({ key }, index) => (
					<Line key={key} dataKey={key} type="monotone" stroke={color(index)} strokeWidth={2} dot={false} />
				))}
			</LineChart>
		);
	if (type === 'area')
		return (
			<AreaChart data={data}>
				{axes}
				{series.map(({ key }, index) => (
					<Area key={key} dataKey={key} type="monotone" stroke={color(index)} fill={color(index)} fillOpacity={0.3} />
				))}
			</AreaChart>
		);
	return (
		<BarChart data={data}>
			{axes}
			{series.map(({ key }) => (
				<Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
			))}
		</BarChart>
	);
}

export function ChartCard({ tool }: { tool: AgentToolPart }): ReactElement {
	if (tool.state === 'output-error') return <ToolActivityGroup tools={[tool]} />;
	const input = tool.state === 'input-streaming' ? undefined : chartInput(tool);
	if (!input) return <Skeleton className="h-64 w-full rounded-xl" />;

	const config: ChartConfig =
		input.type === 'pie'
			? Object.fromEntries(
					input.data.map((row, index) => [String(row[input.xKey]), { label: String(row[input.xKey]), color: color(index) }])
				)
			: Object.fromEntries(input.series.map(({ key, label }, index) => [key, { label, color: color(index) }]));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{input.title}</CardTitle>
				{input.description && <CardDescription>{input.description}</CardDescription>}
			</CardHeader>
			<CardContent>
				<ChartContainer config={config} className="aspect-auto h-64 w-full">
					{renderChart(input)}
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
