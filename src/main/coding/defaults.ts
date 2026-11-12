import type { CodingSettings } from '../../shared/coding_types';
import { codingHarnesses } from './harnesses';

export function codingDefaults(runtime?: string): CodingSettings {
	const harnesses = codingHarnesses();
	const selected =
		harnesses.find((item) => item.info.id === runtime) ??
		harnesses.find((item) => item.model.default) ??
		harnesses[0];
	if (!selected) throw new Error('No coding harness is installed.');
	return {
		runtime: selected.info.id,
		providerId: selected.info.provider.id,
		modelId: '',
		thinkingLevel: 'medium',
		toolMode: 'read-only',
	};
}
