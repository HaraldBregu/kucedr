import { getIdentity } from '../../identity';
import { getSoul } from '../../soul';
import { getUser } from '../../user';

export async function profileStatus(workspacePath: string) {
	const [identity, soul, user] = await Promise.all([
		getIdentity(workspacePath),
		getSoul(workspacePath),
		getUser(workspacePath),
	]);
	const profiles = [
		['IDENTITY.md', identity],
		['SOUL.md', soul],
		['USER.md', user],
	] as const;
	return { profiles, missing: profiles.filter(([, content]) => !content.trim()).map(([name]) => name) };
}
