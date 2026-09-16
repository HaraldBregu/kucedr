export function isGitHubRemoteMcpUrl(url: string): boolean {
	try {
		return new URL(url).hostname === 'api.githubcopilot.com';
	} catch {
		return false;
	}
}
