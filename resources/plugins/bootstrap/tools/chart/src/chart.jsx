import {
	AreaChart, BarChart, CartesianGrid, Legend, LineChart, PieChart,
	PolarAngleAxis, PolarGrid, PolarRadiusAxis, RadarChart, ResponsiveContainer,
	ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Series } from './series.jsx';

const containers = {
	bar: BarChart,
	'horizontal-bar': BarChart,
	'stacked-bar': BarChart,
	line: LineChart,
	area: AreaChart,
	'stacked-area': AreaChart,
	pie: PieChart,
	doughnut: PieChart,
	scatter: ScatterChart,
	radar: RadarChart,
};

export function Chart({ input }) {
	const { type, data, xKey } = input;
	const polar = type === 'pie' || type === 'doughnut' || type === 'radar';
	const horizontal = type === 'horizontal-bar';
	const scatter = type === 'scatter';
	const bar = type === 'bar' || type === 'stacked-bar' || horizontal;
	const Container = containers[type];
	return (
		<ResponsiveContainer width="100%" height="100%" minWidth={0}>
			<Container data={scatter ? undefined : data} layout={horizontal ? 'vertical' : undefined} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
				{!polar && <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--border, GrayText)" />}
				{!polar && <XAxis
					dataKey={scatter ? 'x' : horizontal ? undefined : xKey}
					type={scatter || horizontal ? 'number' : 'category'}
					name={scatter ? xKey : undefined}
					stroke="var(--muted-foreground, CanvasText)" tickLine={false} axisLine={false}
				/>}
				{!polar && <YAxis
					dataKey={scatter ? 'y' : horizontal ? xKey : undefined}
					type={horizontal ? 'category' : 'number'}
					stroke="var(--muted-foreground, CanvasText)" tickLine={false} axisLine={false}
					width={horizontal ? 100 : 48}
				/>}
				{type === 'radar' && <PolarGrid stroke="var(--border, GrayText)" />}
				{type === 'radar' && <PolarAngleAxis dataKey={xKey} tick={{ fill: 'var(--muted-foreground, CanvasText)' }} />}
				{type === 'radar' && <PolarRadiusAxis tick={{ fill: 'var(--muted-foreground, CanvasText)' }} axisLine={false} />}
				<Tooltip
					cursor={polar ? false : bar
						? { fill: 'var(--muted, Canvas)', fillOpacity: 0.5, stroke: 'none' }
						: { stroke: 'var(--border, GrayText)' }}
					contentStyle={{ background: 'var(--popover, Canvas)', color: 'var(--popover-foreground, CanvasText)', border: '1px solid var(--border, GrayText)', borderRadius: 'var(--radius)' }}
					labelStyle={{ color: 'var(--popover-foreground, CanvasText)' }}
					itemStyle={{ color: 'var(--popover-foreground, CanvasText)' }}
				/>
				<Legend wrapperStyle={{ color: 'var(--foreground, CanvasText)' }} />
				<Series input={input} />
			</Container>
		</ResponsiveContainer>
	);
}
