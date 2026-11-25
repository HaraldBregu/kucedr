import { useEffect, useState } from 'react';
import type { LockState } from '@shared/lock';

export function useLock(): {
	state: LockState | null;
	failed: boolean;
	setState: (state: LockState) => void;
} {
	const [state, setState] = useState<LockState | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!window.app?.getLock || !window.app.onLockChanged) {
			setFailed(true);
			return;
		}
		let active = true;
		let changed = false;
		const unsubscribe = window.app.onLockChanged((next) => {
			changed = true;
			setState(next);
			setFailed(false);
		});
		void window.app.getLock().then(
			(initial) => {
				if (active && !changed) setState(initial);
			},
			() => {
				if (active && !changed) setFailed(true);
			}
		);
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);

	return { state, failed, setState };
}
