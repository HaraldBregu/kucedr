import type { DesignDiscipline } from './types';

export function buildRevisionPrompt(instruction: string, discipline: DesignDiscipline): string {
	const subject = discipline === 'industrial' ? 'object silhouette and proportions' : 'structure and spatial geometry';
	return [
		`Using the provided ${discipline} design image, apply only this design revision: ${instruction.trim()}.`,
		`Preserve the ${subject}, camera position, perspective, lighting logic, scale, and every unspecified element.`,
		'Return one finished photorealistic design visualization without text, labels, logos, or watermarks.',
	].join(' ');
}
