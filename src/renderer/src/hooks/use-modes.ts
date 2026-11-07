import { useEffect, useState } from 'react';
import type { AgentModeInfo } from '../../../shared/agent_types';

let request: Promise<AgentModeInfo[]> | undefined;

export function useModes(): readonly AgentModeInfo[] {
	const [modes, setModes] = useState<readonly AgentModeInfo[]>([]);
	useEffect(() => {
		let active = true;
		const load = (): void => {
			request ??= window.agent.listModes();
			request.then(
				(next) => active && setModes(next),
				() => active && setModes([])
			);
		};
		load();
		const unsubscribe = window.app.onModelsChanged(() => {
			request = undefined;
			load();
		});
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);
	return modes;
}
