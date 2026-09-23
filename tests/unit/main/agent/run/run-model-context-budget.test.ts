import {
	fitModelContext,
	type ModelContextBudgetInput,
} from '../../../../../src/main/agent/runner/run_model_context_budget';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';

const makeTool = (name: string, description = name) =>
	jsonTool({
		name,
		description,
		schema: { type: 'object', properties: { value: { type: 'string' } } },
		execute: () => undefined,
	});

describe('fitModelContext', () => {
	it('preserves the current user turn and summarizes oversized tool results before old turns', () => {
		const result = fitModelContext({
			systemPrompt: 'System safety rules.',
			messages: [
				{ role: 'user', content: `old request ${'x'.repeat(8_000)}` },
				{ role: 'assistant', content: 'old answer' },
				{ role: 'user', content: 'current request must remain' },
				{
					role: 'assistant',
					content: '',
					toolCalls: [
						{
							id: 'call-1',
							name: 'read',
							args: { path: 'large.txt' },
							result: { content: 'result'.repeat(2_000) },
						},
					],
				},
			],
			tools: [makeTool('read')],
			maxInputTokens: 900,
		});

		expect(JSON.stringify(result.messages)).toContain('current request must remain');
		expect(JSON.stringify(result.messages)).toContain('tool result omitted');
		expect(JSON.stringify(result.messages)).not.toContain('old request');
		expect(result.estimatedTokens).toBeLessThanOrEqual(900);
	});

	it('keeps every tool schema by trimming optional system context first', () => {
		const input: ModelContextBudgetInput = {
			systemPrompt: `System rules. ${'context '.repeat(700)}`,
			messages: [{ role: 'user', content: 'Use an available tool.' }],
			tools: [
				makeTool('first', 'a'.repeat(300)),
				makeTool('second', 'b'.repeat(300)),
				makeTool('third', 'c'.repeat(300)),
			],
			maxInputTokens: 1_600,
		};

		const result = fitModelContext(input);

		expect(result.tools.map((tool) => tool.name)).toEqual(['first', 'second', 'third']);
		expect(result.systemPrompt).toContain('Additional system context omitted');
		expect(result.estimatedTokens).toBeLessThanOrEqual(input.maxInputTokens);
	});

	it('fails explicitly instead of silently hiding tools that cannot fit', () => {
		expect(() =>
			fitModelContext({
				systemPrompt: 'System rules.',
				messages: [{ role: 'user', content: 'Use an available tool.' }],
				tools: [
					makeTool('first', 'a'.repeat(700)),
					makeTool('second', 'b'.repeat(700)),
					makeTool('third', 'c'.repeat(700)),
				],
				maxInputTokens: 420,
			})
		).toThrow('available tool schemas');
	});

	it('keeps binary attachment payloads without counting base64 as text context', () => {
		const result = fitModelContext({
			systemPrompt: 'System rules.',
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'Inspect this attachment.' },
						{
							type: 'file',
							name: 'large.pdf',
							mimeType: 'application/pdf',
							base64: 'a'.repeat(8_000),
						},
					],
				},
			],
			tools: [],
			maxInputTokens: 700,
		});

		expect(JSON.stringify(result.messages)).toContain('Inspect this attachment.');
		expect(JSON.stringify(result.messages)).toContain('a'.repeat(100));
		expect(result.estimatedTokens).toBeLessThanOrEqual(700);
	});

	it('fails instead of silently truncating oversized current text', () => {
		expect(() =>
			fitModelContext({
				systemPrompt: 'System rules.',
				messages: [{ role: 'user', content: 'x'.repeat(10_000) }],
				tools: [],
				maxInputTokens: 500,
			})
		).toThrow('current user turn');
	});

	it('preserves protected active skill instructions while trimming optional context', () => {
		const protectedSkill = `ACTIVE-SKILL-${'s'.repeat(900)}`;
		const result = fitModelContext({
			systemPrompt: `Base policy ${'b'.repeat(1_200)}`,
			protectedSystemPrompt: protectedSkill,
			contextMessages: [{ role: 'user', content: `optional catalog ${'c'.repeat(1_000)}` }],
			messages: [{ role: 'user', content: 'current request' }],
			tools: [],
			maxInputTokens: 850,
		});

		expect(result.systemPrompt).toContain(protectedSkill);
		expect(JSON.stringify(result.messages)).toContain('current request');
		expect(result.estimatedTokens).toBeLessThanOrEqual(850);
	});

	it('keeps required workspace context when older conversation is trimmed', () => {
		const result = fitModelContext({
			systemPrompt: 'System rules.',
			requiredContextMessages: [{ role: 'user', content: '### AGENTS.md\nAgent rules' }],
			messages: [
				{ role: 'user', content: 'old request '.repeat(300) },
				{ role: 'assistant', content: 'old answer' },
				{ role: 'user', content: 'current request' },
			],
			tools: [],
			maxInputTokens: 500,
		});

		expect(result.messages[0]?.content).toContain('### AGENTS.md');
		expect(JSON.stringify(result.messages)).not.toContain('old request');
	});

	it('fails visibly when required workspace context cannot fit', () => {
		expect(() =>
			fitModelContext({
				systemPrompt: 'System rules.',
				requiredContextMessages: [{ role: 'user', content: '### SOUL.md\n' + 's'.repeat(2_000) }],
				messages: [{ role: 'user', content: 'current request' }],
				tools: [],
				maxInputTokens: 500,
			})
		).toThrow('workspace context');
	});

	it('fails visibly when protected skill instructions cannot fit', () => {
		expect(() =>
			fitModelContext({
				systemPrompt: 'Base policy.',
				protectedSystemPrompt: 'skill'.repeat(1_000),
				messages: [{ role: 'user', content: 'current request' }],
				tools: [],
				maxInputTokens: 500,
			})
		).toThrow('active skill instructions');
	});
});
