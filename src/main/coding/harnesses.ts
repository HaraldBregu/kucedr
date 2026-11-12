import type { CodingHarnessInfo } from '../../shared/coding_types';
import type { CatalogModel } from '../../shared/model_types';
import { modelsFor } from '../models';

export interface CodingHarnessEntry {
	readonly info: CodingHarnessInfo;
	readonly model: CatalogModel;
	readonly credentialKey: string;
}

export function codingHarnesses(): CodingHarnessEntry[] {
	return modelsFor('coding-agent').map((model) => ({
		info: {
			id: model.id,
			name: model.name,
			provider: {
				id: `${model.provider.id}-${model.id}`,
				name: `${model.provider.name} ${model.name}`,
			},
		},
		model,
		credentialKey: `${model.id}:${model.provider.id}`,
	}));
}
