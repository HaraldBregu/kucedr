export type ContextMenuRole =
	| 'undo'
	| 'redo'
	| 'cut'
	| 'copy'
	| 'paste'
	| 'pasteAndMatchStyle'
	| 'delete'
	| 'selectAll';

export type ContextMenuDescriptor =
	| { type: 'separator' }
	| {
			type: 'role';
			role: ContextMenuRole;
			label?: string;
			enabled?: boolean;
	  }
	| {
			type?: 'item';
			id: string;
			label: string;
			accelerator?: string;
			enabled?: boolean;
	  };
