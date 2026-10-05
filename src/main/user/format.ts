import type { UserSettings } from './schema';

export function formatUser(user: UserSettings): string {
	return [
		`- **Name:** ${user.name}`,
		...(user.title ? [`- **Title:** ${user.title}`] : []),
		...(user.preferredName ? [`- **What to call them:** ${user.preferredName}`] : []),
		...(user.pronouns ? [`- **Pronouns:** ${user.pronouns}`] : []),
		...(user.timezone ? [`- **Timezone:** ${user.timezone}`] : []),
		...(user.projects ? [`- **Projects:** ${user.projects}`] : []),
		...(user.preferences ? [`- **Preferences:** ${user.preferences}`] : []),
		...(user.notes ? [`- **Notes:** ${user.notes}`] : []),
	].join('\n');
}
