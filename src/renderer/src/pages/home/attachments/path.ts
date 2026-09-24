const restoredPaths = new WeakMap<File, string>();

export function attachmentPath(file: File, restoredPath?: string): string {
	if (restoredPath !== undefined) {
		restoredPaths.set(file, restoredPath);
		return restoredPath;
	}
	return restoredPaths.get(file) ?? window.app.getPathForFile(file);
}
