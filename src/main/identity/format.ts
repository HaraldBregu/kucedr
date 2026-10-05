import type { IdentitySettings } from './schema';

export function formatIdentity(identity: IdentitySettings): string {
	const metadata = identity.metadata
		?.split(/\r?\n/)
		.flatMap((line) => {
			const detail = line.replace(/^\s*(?:-\s*)?\*\*Metadata:\*\*\s*/i, '');
			const trimmed = detail.trim();
			if (/^#\s+IDENTITY\.md\b/i.test(trimmed)) return [];
			if (/^#\s+/.test(trimmed) && trimmed.replace(/^#\s+/, '').toLowerCase() === identity.name.toLowerCase()) return [];
			if (/^(?:-\s*)?\*\*(?:Name|Title|Role|Avatar|Vibe):\*\*/i.test(trimmed)) return [];
			return [detail];
		})
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return [
		`- **Name:** ${identity.name}`,
		...(identity.title ? [`- **Title:** ${identity.title}`] : []),
		`- **Role:** ${identity.role}`,
		...(identity.avatar ? [`- **Avatar:** ${identity.avatar}`] : []),
		...(identity.vibe ? [`- **Vibe:** ${identity.vibe}`] : []),
		...(metadata ? [`\n${metadata}`] : []),
	].join('\n');
}
