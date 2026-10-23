import { workspaceFileType } from '@shared/workspace';

const assetKinds = new Set(['image', 'audio', 'video', 'pdf']);

export function importWorkspaceAssets(path: string, files: File[]): Promise<{ file: File; src: string; image: boolean }[]> | null {
	const assets = files.filter((file) => assetKinds.has(workspaceFileType(file.name).kind));
	if (assets.length === 0) return null;
	return Promise.all(assets.map(async (file) => {
		const src = await window.agent.importWorkspaceAsset(path, file.name, new Uint8Array(await file.arrayBuffer()));
		return { file, src, image: workspaceFileType(src).kind === 'image' };
	}));
}
