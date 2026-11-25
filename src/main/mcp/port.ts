import { getMcpOAuthRedirectUrl } from './redirect';

export function registeredPort(redirectUris: string[] = []): number {
	for (const uri of redirectUris) {
		try {
			return Number(new URL(getMcpOAuthRedirectUrl(uri)).port);
		} catch {
			continue;
		}
	}
	return 0;
}
