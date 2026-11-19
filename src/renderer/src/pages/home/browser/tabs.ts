import { useEffect, useMemo, useState } from 'react';
import type { BrowserPaneState, BrowserPaneTab } from '../../../../../shared/browser';

export function useBrowserTabs(chat: string): {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: boolean;
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
	return useMemo(
		() => ({
			tabs: state.tabs.filter((tab) => tab.chat === chat),
			acting: state.acting.includes(chat),
		}),
		[state, chat]
	);
}
