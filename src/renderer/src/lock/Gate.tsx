import React, { type ReactNode } from 'react';
import { useLock } from '@/hooks/lock';
import { Screen } from './Screen';

export function LockGate({ children }: { readonly children: ReactNode }): React.JSX.Element {
	const { state, failed } = useLock();

	if (state?.locked) return <Screen touchId={state.touchId && state.touchIdAvailable} />;
	if (state || failed) return <>{children}</>;
	return <div className="h-screen bg-background" aria-label="Loading application" />;
}
