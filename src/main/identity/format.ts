import type { IdentitySettings } from './schema';

export function formatIdentity(identity: IdentitySettings): string {
	const metadata = identity.metadata
		?.split(/\r?\n/)
		.flatMap((line) => {
			const trimmed = line.trim();
			if (/^#\s+IDENTITY\.md\b/i.test(trimmed)) return [];
			if (/^#\s+/.test(trimmed) && trimmed.replace(/^#\s+/, '').toLowerCase() === identity.name.toLowerCase()) return [];
			if (/^(?:-\s*)?\*\*(?:Name|Role|Avatar|Vibe):\*\*/i.test(trimmed)) return [];
			return [line.replace(/^\s*(?:-\s*)?\*\*Metadata:\*\*\s*/i, '')];
		})
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return [
		`- **Name:** ${identity.name}`,
		`- **Role:** ${identity.role}`,
		...(identity.avatar ? [`- **Avatar:** ${identity.avatar}`] : []),
		...(identity.vibe ? [`- **Vibe:** ${identity.vibe}`] : []),
		...(metadata ? [`- **Metadata:** ${metadata}`] : []),
	].join('\n');
}
