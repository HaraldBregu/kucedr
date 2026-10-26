import { z } from 'zod';
import { tool } from '../tool';

export const createChartTool = tool({
	id: 'create_chart',
	category: 'media',
	name: 'Create chart',
	description:
		'Render a chart in the chat. Use when the user asks for a chart, graph, or plot, or when comparing numbers across categories or time would be clearer visually. Provide real data only, never invent values.',
	planSafe: true,
	inputSchema: z.object({
		type: z.enum(['bar', 'line', 'area', 'pie']),
		title: z.string().min(1),
		description: z.string().optional(),
		data: z
			.array(z.record(z.string(), z.union([z.string(), z.number()])))
			.min(1)
			.max(200)
			.describe('Rows of data, each with the xKey field and one numeric field per series.'),
		xKey: z.string().describe('Field used for the x-axis categories, or slice names for pie.'),
		series: z
			.array(z.object({ key: z.string(), label: z.string() }))
			.min(1)
			.max(6)
			.describe('Numeric fields to plot. Pie uses only the first series.'),
	}),
	execute: () => ({ ok: true }),
});
