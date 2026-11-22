import { existsSync } from 'node:fs';
import path from 'node:path';
import { discover } from '../../browser/discover';
import { PROFILES_ROOT_FILE } from '../../browser/formats';
import { dataRoots } from '../../browser/roots';
import { SEARCH_DEPTH } from '../../browser/sources';

export const browserProfiles: string[] = [];

export async function findBrowserProfiles(): Promise<void> {
	for (const root of dataRoots())
		for (const profile of await discover(root, SEARCH_DEPTH).catch(() => []))
			browserProfiles.push(
				[profile, path.dirname(profile)].find((directory) =>
					existsSync(path.join(directory, PROFILES_ROOT_FILE))
				) ?? profile
			);
}
