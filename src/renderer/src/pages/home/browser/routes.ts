import { Network, VenetianMask, Waypoints, type LucideIcon } from 'lucide-react';
import type { BrowserRoute } from '../../../../../shared/browser';

export const ROUTE_LOOKS: Record<Exclude<BrowserRoute, 'direct'>, { label: string; icon: LucideIcon; hint: string }> = {
	private: {
		label: 'browserPane.routes.private.label',
		icon: VenetianMask,
		hint: 'browserPane.routes.private.hint',
	},
	tor: {
		label: 'browserPane.routes.tor.label',
		icon: Waypoints,
		hint: 'browserPane.routes.tor.hint',
	},
	proxy: {
		label: 'browserPane.routes.proxy.label',
		icon: Network,
		hint: 'browserPane.routes.proxy.hint',
	},
};
