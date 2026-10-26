import type { ReactElement } from 'react';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from '@/components/ui/chart';
import type { ChartInput } from './parse';

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
					<Line
						key={key}
						dataKey={key}
						type="monotone"
						stroke={color(index)}
						strokeWidth={2}
						dot={false}
					/>
				))}
			</LineChart>
		);
	if (type === 'area')
		return (
			<AreaChart data={data}>
				{axes}
				{series.map(({ key }, index) => (
					<Area
						key={key}
						dataKey={key}
						type="monotone"
						stroke={color(index)}
						fill={color(index)}
						fillOpacity={0.3}
					/>
				))}
			</AreaChart>
		);
	return (
		<BarChart data={data}>
			{axes}
			{series.map(({ key }, index) => (
				<Bar key={key} dataKey={key} fill={color(index)} radius={4} />
			))}
		</BarChart>
	);
}

export function Chart({ chart }: { chart: ChartInput }): ReactElement {
	const config: ChartConfig =
		chart.type === 'pie'
			? Object.fromEntries(
					chart.data.map((row, index) => [
						String(row[chart.xKey]),
						{ label: String(row[chart.xKey]), color: color(index) },
					])
				)
			: Object.fromEntries(
					chart.series.map(({ key, label }, index) => [key, { label, color: color(index) }])
				);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{chart.title}</CardTitle>
				{chart.description && <CardDescription>{chart.description}</CardDescription>}
			</CardHeader>
			<CardContent>
				<ChartContainer config={config} className="aspect-auto h-64 w-full">
					{renderChart(chart)}
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
