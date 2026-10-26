import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';

const colors = Array.from(
	{ length: 5 },
	(_, index) => `var(--chart-${index + 1}, var(--primary, CanvasText))`
);
colors.push('var(--primary, CanvasText)');

export function Chart({ input: { type, data, xKey, series } }) {
	const round = type === 'pie' || type === 'doughnut';
	const Container = round
		? PieChart
		: type === 'bar'
			? BarChart
			: type === 'area'
				? AreaChart
				: LineChart;
	return (
		<ResponsiveContainer width="100%" height="100%" minWidth={0}>
			<Container data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
				{!round && <CartesianGrid vertical={false} stroke="var(--border, GrayText)" />}
				{!round && (
					<XAxis
						dataKey={xKey}
						stroke="var(--muted-foreground, CanvasText)"
						tickLine={false}
						axisLine={false}
					/>
				)}
				{!round && (
					<YAxis
						stroke="var(--muted-foreground, CanvasText)"
						tickLine={false}
						axisLine={false}
						width={48}
					/>
				)}
				<Tooltip
					cursor={
						type === 'bar'
							? { fill: 'var(--muted, Canvas)', fillOpacity: 0.5, stroke: 'none' }
							: { stroke: 'var(--border, GrayText)' }
					}
					contentStyle={{
						background: 'var(--popover, Canvas)',
						color: 'var(--popover-foreground, CanvasText)',
						border: '1px solid var(--border, GrayText)',
						borderRadius: 'var(--radius)',
					}}
					labelStyle={{ color: 'var(--popover-foreground, CanvasText)' }}
					itemStyle={{ color: 'var(--popover-foreground, CanvasText)' }}
				/>
				<Legend wrapperStyle={{ color: 'var(--foreground, CanvasText)' }} />
				{round ? (
					<Pie
						data={data}
						dataKey={series[0].key}
						nameKey={xKey}
						innerRadius={type === 'doughnut' ? '55%' : 0}
						outerRadius="80%"
						stroke="var(--background, Canvas)"
						isAnimationActive={false}
					>
						{data.map((_, index) => (
							<Cell key={index} fill={colors[index % colors.length]} />
						))}
					</Pie>
				) : (
					series.map(({ key, label }, index) => {
						const color = colors[index % colors.length];
						if (type === 'bar')
							return (
								<Bar
									key={key}
									dataKey={key}
									name={label}
									fill={color}
									radius={[4, 4, 0, 0]}
									isAnimationActive={false}
								/>
							);
						if (type === 'area')
							return (
								<Area
									key={key}
									dataKey={key}
									name={label}
									type="monotone"
									stroke={color}
									fill={color}
									fillOpacity={0.2}
									activeDot={{ fill: color, stroke: 'var(--background, Canvas)' }}
									isAnimationActive={false}
								/>
							);
						return (
							<Line
								key={key}
								dataKey={key}
								name={label}
								type="monotone"
								stroke={color}
								strokeWidth={2}
								dot={{ fill: 'var(--background, Canvas)', stroke: color }}
								activeDot={{ fill: color, stroke: 'var(--background, Canvas)' }}
								isAnimationActive={false}
							/>
						);
					})
				)}
			</Container>
		</ResponsiveContainer>
	);
}
