export interface LibraryFile {
	readonly kind?: 'folder';
	readonly name: string;
	readonly path: string;
	readonly relativePath: string;
	readonly size: number;
	readonly modifiedAt: string;
}
