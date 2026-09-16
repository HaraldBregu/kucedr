import type { GenerationBrief } from './types';

export function buildBriefPrompt(brief: GenerationBrief): string {
	const discipline = {
		interior: 'photorealistic architectural interior visualization',
		exterior: 'photorealistic architectural exterior visualization',
		industrial: 'photorealistic industrial design visualization',
	}[brief.discipline];
	const composition = {
		interior:
			'Use an eye-level architectural camera, believable wide-angle perspective, coherent circulation, buildable proportions, realistic scale, and editorial archviz detail.',
		exterior:
			'Use a site-aware architectural camera, believable massing, buildable proportions, climate-aware materials, realistic scale, and editorial archviz detail.',
		industrial:
			'Use a considered product camera, convincing ergonomics, manufacturable details, realistic scale, clear material transitions, and editorial product-visualization detail.',
	}[brief.discipline];
	return [
		`Create a finished, ${discipline} of a ${brief.subject}.`,
		`Design brief: ${brief.description.trim()}.`,
		`Context and use: ${brief.context}. Design language: ${brief.style}. Materials: ${brief.materials}. Lighting: ${brief.lighting}.`,
		`Compose for a ${brief.ratio} frame. ${composition}`,
		'No people, labels, floor-plan overlays, text, logos, or watermarks.',
	].join(' ');
}
