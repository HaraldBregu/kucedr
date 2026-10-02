import { formatIdentity, getIdentity } from '../../identity';
import { formatSoul, getSoul } from '../../soul';
import { formatUser, getUser } from '../../user';

export async function profileStatus(workspacePath: string) {
	const [identity, soul, user] = await Promise.all([
		getIdentity(workspacePath),
		getSoul(workspacePath),
		getUser(workspacePath),
	]);
	const profiles = [
		['IDENTITY.md', identity ? formatIdentity(identity) : ''],
		['SOUL.md', soul ? formatSoul(soul) : ''],
		['USER.md', user ? formatUser(user) : ''],
	] as const;
	return {
		profiles,
		missing: profiles.filter(([, content]) => !content.trim()).map(([name]) => name),
	};
}
