import { Area, Bar, Cell, Line, Pie, Radar, Scatter } from 'recharts';

const colors = Array.from({ length: 5 }, (_, index) => `var(--chart-${index + 1}, var(--primary, CanvasText))`);
colors.push('var(--primary, CanvasText)');

export function Series({ input: { type, data, xKey, series } }) {
	if (type === 'pie' || type === 'doughnut') return (
		<Pie data={data} dataKey={series[0].key} nameKey={xKey} innerRadius={type === 'doughnut' ? '55%' : 0} outerRadius="80%" stroke="var(--background, Canvas)" isAnimationActive={false}>
			{data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
		</Pie>
	);
	return series.map(({ key, label }, index) => {
		const color = colors[index % colors.length];
		const props = { dataKey: key, name: label, isAnimationActive: false };
		const activeDot = { fill: color, stroke: 'var(--background, Canvas)' };
		switch (type) {
			case 'bar':
			case 'horizontal-bar':
			case 'stacked-bar':
				return <Bar key={key} {...props} fill={color} stackId={type === 'stacked-bar' ? 'total' : undefined} radius={type === 'stacked-bar' ? 0 : type === 'horizontal-bar' ? [0, 4, 4, 0] : [4, 4, 0, 0]} />;
			case 'area':
			case 'stacked-area':
				return <Area key={key} {...props} type="monotone" stroke={color} fill={color} fillOpacity={0.2} stackId={type === 'stacked-area' ? 'total' : undefined} activeDot={activeDot} />;
			case 'radar':
				return <Radar key={key} {...props} stroke={color} fill={color} fillOpacity={0.2} activeDot={activeDot} />;
			case 'scatter':
				return <Scatter key={key} name={label} data={data.map((row) => ({ x: row[xKey], y: row[key] }))} fill={color} activeShape={{ stroke: 'var(--background, Canvas)', strokeWidth: 2 }} isAnimationActive={false} />;
			default:
				return <Line key={key} {...props} type="monotone" stroke={color} strokeWidth={2} dot={{ fill: 'var(--background, Canvas)', stroke: color }} activeDot={activeDot} />;
		}
	});
}
