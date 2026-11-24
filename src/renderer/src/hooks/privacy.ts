import { useEffect, useState } from 'react';

type PrivacyState = Awaited<ReturnType<typeof window.app.getPrivacy>>;

export function usePrivacy(): {
	state: PrivacyState | null;
	failed: boolean;
	setState: (state: PrivacyState) => void;
} {
	const [state, setState] = useState<PrivacyState | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!window.app?.getPrivacy || !window.app.onPrivacyChanged) {
			setFailed(true);
			return;
		}
		let active = true;
		let changed = false;
		const unsubscribe = window.app.onPrivacyChanged((next) => {
			changed = true;
			setState(next);
			setFailed(false);
		});
		void window.app.getPrivacy().then(
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
