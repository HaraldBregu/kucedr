import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isSetupComplete } from '@/auth/setup';
import { useAuth } from './AuthContext';
import { OnboardingContext, type OnboardingContextValue, type OnboardingPhase } from './onboarding';

type ConfigurationState = {
	identity?: string;
	status: 'idle' | 'checking' | 'incomplete' | 'complete';
};

const ONBOARDING_STARTED_SESSION_KEY = 'kucedr-onboarding-started';

export function OnboardingProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
	const { state, localOnly } = useAuth();
	const [started, setStarted] = useState(
		() => window.sessionStorage.getItem(ONBOARDING_STARTED_SESSION_KEY) === 'true'
	);
	const [configuration, setConfiguration] = useState<ConfigurationState>({ status: 'idle' });
	const requestId = useRef(0);
	const identity = state.status === 'signedIn' ? state.user?.id : localOnly ? 'local' : undefined;
	const configurationStatus =
		configuration.identity === identity || (localOnly && configuration.status === 'complete')
			? configuration.status
			: 'idle';
	const active =
		started || state.status === 'signedIn' || (localOnly && configuration.status === 'complete');

	const refreshConfiguration = useCallback(async (): Promise<boolean> => {
		if (!identity) {
			setConfiguration({ status: 'idle' });
			return false;
		}

		const currentRequest = ++requestId.current;
		setConfiguration({ identity, status: 'checking' });
		try {
			const complete = await isSetupComplete();
			if (requestId.current === currentRequest) {
				setConfiguration({ identity, status: complete ? 'complete' : 'incomplete' });
			}
			return complete;
		} catch {
			if (requestId.current === currentRequest) {
				setConfiguration({ identity, status: 'incomplete' });
			}
			return false;
		}
	}, [identity]);

	useEffect(() => {
		if (!active || !identity) {
			requestId.current += 1;
			return;
		}

		const currentRequest = ++requestId.current;
		void isSetupComplete()
			.then((complete) => {
				if (requestId.current === currentRequest) {
					setConfiguration({ identity, status: complete ? 'complete' : 'incomplete' });
				}
			})
			.catch(() => {
				if (requestId.current === currentRequest) {
					setConfiguration({ identity, status: 'incomplete' });
				}
			});
		return () => {
			requestId.current += 1;
		};
	}, [active, identity]);

	let phase: OnboardingPhase;
	if (state.status === 'recovery') phase = 'auth';
	else if (state.status === 'loading' && !localOnly) phase = 'checking';
	else if (!active) phase = 'landing';
	else if (!identity) phase = 'auth';
	else if (configurationStatus === 'complete') phase = 'ready';
	else if (configurationStatus === 'incomplete') phase = 'setup';
	else phase = 'checking';

	const value = useMemo<OnboardingContextValue>(
		() => ({
			phase,
			start: () => {
				window.sessionStorage.setItem(ONBOARDING_STARTED_SESSION_KEY, 'true');
				setStarted(true);
			},
			restart: () => {
				window.sessionStorage.removeItem(ONBOARDING_STARTED_SESSION_KEY);
				setStarted(false);
			},
			refreshConfiguration,
		}),
		[phase, refreshConfiguration]
	);

	return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
