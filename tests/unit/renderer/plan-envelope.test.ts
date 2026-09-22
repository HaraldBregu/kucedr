import { parsePlanEnvelope } from '../../../src/renderer/src/pages/home/components/plan';

describe('plan envelope parsing', () => {
	it('accepts one fully anchored envelope', () => {
		expect(parsePlanEnvelope('<proposed_plan>\n## Steps\n\n1. Inspect\n</proposed_plan>', false)).toEqual({
			kind: 'complete',
			content: '## Steps\n\n1. Inspect',
		});
	});

	it('hides incomplete envelope markers while streaming', () => {
		expect(parsePlanEnvelope('<proposed_', true)).toEqual({ kind: 'streaming', content: '' });
		expect(parsePlanEnvelope('<proposed_plan>Step one</proposed_', true)).toEqual({
			kind: 'streaming',
			content: 'Step one',
		});
	});

	it.each([
		'<proposed_plan></proposed_plan>',
		'Before <proposed_plan>Plan</proposed_plan>',
		'<proposed_plan>One</proposed_plan><proposed_plan>Two</proposed_plan>',
		'<proposed_plan>Missing close',
	])('keeps malformed output as Markdown: %s', (content) => {
		expect(parsePlanEnvelope(content, false)).toEqual({ kind: 'markdown', content });
	});
});
