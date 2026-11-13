import { desktopCapturer } from 'electron';
import path from 'node:path';
import { agentLocation } from '../../../shared/agent_location';

export async function captureSource(
	target: 'full_screen' | 'workspace' | 'application' | undefined,
	sourceId: string | undefined
) {
	const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
	if (sources.length === 0) {
		throw new Error('No display or window is available to record.');
	}
	const workspaceName = path.basename(agentLocation()).toLocaleLowerCase();
	const applicationSource = sources.find(
		(source) => !source.id.startsWith('screen:') && source.name.toLocaleLowerCase().includes('kucedr')
	);
	const windowSource = sources.find((source) => !source.id.startsWith('screen:'));
	const selectedSource = sourceId
		? sources.find((source) => source.id === sourceId)
		: target === 'full_screen'
			? sources.find((source) => source.id.startsWith('screen:'))
			: target === 'workspace'
				? sources.find(
						(source) =>
							!source.id.startsWith('screen:') &&
							source.name.toLocaleLowerCase().includes(workspaceName)
					)
					?? applicationSource
					?? windowSource
				: target === 'application'
					? applicationSource ?? windowSource
					: undefined;
	if (!selectedSource && !target && !sourceId) {
		return {
			status: 'selection_required' as const,
			sources: sources.map((source) => ({
				id: source.id,
				name: source.name || 'Untitled source',
				type: source.id.startsWith('screen:') ? ('screen' as const) : ('window' as const),
			})),
		};
	}
	if (!selectedSource) {
		if (target) {
			throw new Error(`No ${target.replace('_', ' ')} source is available to record.`);
		}
		throw new Error('The selected screen source is no longer available. Start again to choose a source.');
	}
	return selectedSource.id;
}
