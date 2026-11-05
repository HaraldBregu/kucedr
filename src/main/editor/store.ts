import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../shared/user_data_location';
import { getModelId, getProviderId } from '../agent/agent_store';

type WorkspaceModel = { providerId: string; modelId: string };

const store = new Store<{ model?: WorkspaceModel; imageModel?: WorkspaceModel }>({
	name: 'editor',
	cwd: path.resolve(userDataLocation(), 'settings'),
});

export function getWorkspaceModel(): WorkspaceModel {
	const saved = store.get('model');
	if (saved) return saved;
	const model = { providerId: getProviderId() ?? '', modelId: getModelId() ?? '' };
	if (model.providerId && model.modelId) store.set('model', model);
	return model;
}

export function setWorkspaceModel(model: WorkspaceModel): void {
	if (typeof model?.providerId !== 'string' || typeof model?.modelId !== 'string' || !model.providerId.trim() || !model.modelId.trim()) throw new Error('Invalid workspace model.');
	store.set('model', { providerId: model.providerId.trim(), modelId: model.modelId.trim() });
}

export function getWorkspaceImageModel(): WorkspaceModel {
	return store.get('imageModel') ?? { providerId: '', modelId: '' };
}

export function setWorkspaceImageModel(model: WorkspaceModel): void {
	if (typeof model?.providerId !== 'string' || typeof model?.modelId !== 'string' || !model.providerId.trim() || !model.modelId.trim()) throw new Error('Invalid workspace image model.');
	store.set('imageModel', { providerId: model.providerId.trim(), modelId: model.modelId.trim() });
}
