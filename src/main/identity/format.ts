import type { IdentitySettings } from './schema';

export function formatIdentity(identity: IdentitySettings): string {
	return [
		`- **Name:** ${identity.name}`,
		`- **Role:** ${identity.role}`,
		...(identity.avatar ? [`- **Avatar:** ${identity.avatar}`] : []),
		...(identity.vibe ? [`- **Vibe:** ${identity.vibe}`] : []),
		...(identity.metadata ? [`- **Metadata:** ${identity.metadata}`] : []),
	].join('\n');
}
