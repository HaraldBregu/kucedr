export type ChartInput = {
	type: 'bar' | 'line' | 'area' | 'pie';
	title: string;
	description?: string;
	data: Record<string, string | number>[];
	xKey: string;
	series: { key: string; label: string }[];
};

export function parseChart(value: unknown): ChartInput | undefined {
	const input = value as Partial<ChartInput> | undefined;
	if (!input || typeof input !== 'object') return undefined;
	if (!Array.isArray(input.data) || !Array.isArray(input.series) || !input.series.length) return undefined;
	if (!input.xKey || !['bar', 'line', 'area', 'pie'].includes(input.type ?? '')) return undefined;
	return input as ChartInput;
}
