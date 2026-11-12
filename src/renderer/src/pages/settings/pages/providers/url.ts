import type { ProviderBaseUrlSetting } from '@shared/provider_types';

export function acceptsBaseUrl(setting: ProviderBaseUrlSetting, value: string): boolean {
	try {
		const href = new URL(value).href;
		return !setting.pattern || new RegExp(setting.pattern, 'i').test(href);
	} catch {
		return false;
	}
}
