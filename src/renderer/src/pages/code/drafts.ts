export interface Draft {
	content: string;
	saved: string;
	error: string;
	pending?: Promise<void>;
}
export const drafts = new Map<string, Draft>();
