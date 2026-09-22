export type UpdateChunk = {
	changeContext?: string;
	oldLines: string[];
	newLines: string[];
	isEndOfFile: boolean;
};

export type Hunk =
	| { kind: 'add'; path: string; contents: string }
	| { kind: 'delete'; path: string }
	| { kind: 'update'; path: string; movePath?: string; chunks: UpdateChunk[] };

