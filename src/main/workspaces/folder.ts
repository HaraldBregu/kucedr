import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { samePathOrWithin } from '../agent/permissions/same_path_or_within';
import { userDataLocation } from '../shared/user_data_location';
import { readWorkspaces } from './read';

export function workspaceFolder(folder: string, except?: string): string {
	let real: string;
	try {
		real = realpathSync(folder);
		if (!statSync(real).isDirectory()) throw new Error();
		accessSync(real, constants.R_OK);
	} catch {
		throw new Error('Choose a folder that exists and can be read.');
	}
	const data = userDataLocation();
	if (path.dirname(real) === real || samePathOrWithin(os.homedir(), real))
		throw new Error('The home folder and the folders above it cannot be a workspace.');
	if (samePathOrWithin(real, data) || samePathOrWithin(data, real))
		throw new Error('This folder holds Kucedr data, so it cannot be a workspace.');
	for (const record of readWorkspaces())
		if (
			record.id !== except &&
			(samePathOrWithin(real, record.folder) || samePathOrWithin(record.folder, real))
		)
			throw new Error(`This folder overlaps the workspace "${record.name}".`);
	return real;
}
