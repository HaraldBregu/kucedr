export interface DriveFile {
	id: string;
	name: string;
	mimeType: string;
	description?: string;
	parents?: string[];
	size?: string;
	modifiedTime?: string;
	webViewLink?: string;
	properties?: Record<string, string>;
	md5Checksum?: string;
	trashed?: boolean;
}

export interface DriveCreateInput {
	name: string;
	mimeType?: string;
	parentId?: string;
	content?: string;
	description?: string;
}

export interface DriveUpdateInput {
	name?: string;
	description?: string;
	properties?: Record<string, string>;
	parentId?: string;
	content?: string;
}

export interface DriveSyncResult {
	uploaded: number;
	skipped: number;
	failed: number;
}
