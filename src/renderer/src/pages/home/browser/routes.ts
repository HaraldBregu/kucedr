import { Network, VenetianMask, Waypoints, type LucideIcon } from 'lucide-react';
import type { BrowserRoute } from '../../../../../shared/browser';

export const ROUTE_LOOKS: Record<Exclude<BrowserRoute, 'direct'>, { label: string; icon: LucideIcon; hint: string }> = {
	private: {
		label: 'Private',
		icon: VenetianMask,
		hint: 'Private tab: no logins, history or cookies are kept, and everything is wiped when it closes.',
	},
	tor: {
		label: 'Tor',
		icon: Waypoints,
		hint: 'Tor tab: pages load through Tor and sites do not see your network address. This is not Tor Browser, so do not rely on it for anonymity. Downloads are off.',
	},
	proxy: {
		label: 'Proxy',
		icon: Network,
		hint: 'Proxy tab: pages load through the proxy set in Settings → Browser. Nothing is kept after it closes.',
	},
};
