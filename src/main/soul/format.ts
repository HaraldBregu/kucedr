import type { SoulSettings } from './schema';

export function formatSoul(soul: SoulSettings): string {
	return [
		`- **Tone:** ${soul.tone}`,
		...(soul.boundaries ? [`- **Boundaries:** ${soul.boundaries}`] : []),
		...(soul.interactionStyle ? [`- **Interaction style:** ${soul.interactionStyle}`] : []),
		...(soul.notes ? [`- **Notes:** ${soul.notes}`] : []),
	].join('\n');
}
