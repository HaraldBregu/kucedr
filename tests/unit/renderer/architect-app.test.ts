import type { CatalogModel } from '../../../src/shared/model_types';
import { buildBriefPrompt } from '../../../resources/apps/architect/src/brief';
import { createGenerationOptions } from '../../../resources/apps/architect/src/options';
import { buildRevisionPrompt } from '../../../resources/apps/architect/src/revision';
import { selectEditModel } from '../../../resources/apps/architect/src/model';

const provider = { id: 'black-forest-labs', name: 'BFL' } as CatalogModel['provider'];
const catalog = [
	{
		id: 'FLUX.2',
		name: 'FLUX.2',
		type: 'text-to-image',
		provider,
		metadata: { documentationUrl: 'https://example.test', inputs: { aspect_ratio: {} } },
	},
	{
		id: 'FLUX.1 Kontext [pro]',
		name: 'Kontext',
		type: 'text-to-image',
		provider,
		metadata: { documentationUrl: 'https://example.test', inputs: { input_image: {} } },
	},
] as CatalogModel[];

describe('Architect app workflow', () => {
	it('builds a domain-specific interior visualization prompt', () => {
		const prompt = buildBriefPrompt({
			discipline: 'interior',
			description: 'a sunken conversation area facing the garden',
			subject: 'living room',
			context: 'a garden-facing private residence',
			style: 'quiet modernism',
			materials: 'travertine and walnut',
			lighting: 'soft northern daylight',
			ratio: '16:9',
		});
		expect(prompt).toContain('photorealistic architectural interior visualization');
		expect(prompt).toContain('buildable proportions');
		expect(prompt).toContain('travertine and walnut');
	});

	it('changes prompt constraints for exterior and industrial concepts', () => {
		const base = {
			description: 'a quiet, durable design with a clear identity',
			style: 'quiet modernism',
			materials: 'powder-coated aluminium and oak',
			lighting: 'soft northern daylight',
			ratio: '16:9' as const,
		};
		expect(
			buildBriefPrompt({
				...base,
				discipline: 'exterior',
				subject: 'private residence',
				context: 'a wooded hillside site',
			})
		).toContain('architectural exterior visualization');
		expect(
			buildBriefPrompt({
				...base,
				discipline: 'industrial',
				subject: 'lounge chair',
				context: 'a domestic reading corner',
			})
		).toContain('manufacturable details');
	});

	it('constrains revisions to the requested design change', () => {
		const prompt = buildRevisionPrompt('replace the sofa with a low modular sectional', 'interior');
		expect(prompt).toContain('apply only this design revision');
		expect(prompt).toContain('Preserve the structure and spatial geometry, camera position, perspective');
	});

	it('selects a compatible edit model without switching providers', () => {
		expect(selectEditModel(catalog, 'black-forest-labs', 'FLUX.2')?.id).toBe(
			'FLUX.1 Kontext [pro]'
		);
		expect(selectEditModel(catalog, 'xai', 'grok-imagine-image')).toBeUndefined();
	});

	it('maps aspect-ratio controls through model metadata', () => {
		expect(
			createGenerationOptions(catalog[0], {
				discipline: 'interior',
				description: 'room',
				subject: 'living room',
				context: 'home',
				style: 'modern',
				materials: 'oak',
				lighting: 'daylight',
				ratio: '16:9',
			})
		).toEqual({ aspect_ratio: '16:9' });
	});
});
