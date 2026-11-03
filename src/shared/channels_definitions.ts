import type { ChannelType } from './channels_types';

export function isChannelId(value: string): value is ChannelType {
	return /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(value);
}
