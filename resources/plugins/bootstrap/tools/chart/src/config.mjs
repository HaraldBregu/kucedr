export function chartConfig({ type, data, xKey, series }, { text, grid, colors }) {
	const labels = data.map((row) => String(row[xKey]));
	const round = type === 'pie' || type === 'doughnut';
	const datasets = round
		? [{ label: series[0].label, data: data.map((row) => row[series[0].key]), backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderWidth: 0 }]
		: series.map(({ key, label }, i) => {
				const color = colors[i % colors.length];
				return {
					label,
					data: data.map((row) => row[key]),
					borderColor: color,
					backgroundColor: type === 'area' ? `${color}4d` : color,
					fill: type === 'area',
					tension: 0.3,
					borderRadius: type === 'bar' ? 4 : 0,
				};
			});
	return {
		type: type === 'area' ? 'line' : type,
		data: { labels, datasets },
		options: {
			animation: false,
			maintainAspectRatio: false,
			color: text,
			plugins: { legend: { labels: { color: text } } },
			scales: round
				? {}
				: {
						x: { ticks: { color: text }, grid: { display: false } },
						y: { ticks: { color: text }, grid: { color: grid } },
					},
		},
	};
}

