import { useEffect, useState } from 'react';
import type { BrowserPaneState, BrowserPaneTab } from '../../../../../shared/browser';

// The browser is shared by every chat: all tabs, and the chats whose agent is acting right now.
export function useBrowserTabs(): {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: readonly string[];
} {
	const [state, setState] = useState<BrowserPaneState>({ tabs: [], acting: [] });
	useEffect(() => {
		let live = false;
		const off = window.browserPane.onChanged((next) => {
			live = true;
			setState(next);
		});
		void window.browserPane
			.state()
			.then((initial) => {
				if (!live) setState(initial);
			})
			.catch(() => undefined);
		return off;
	}, []);
	return state;
}
