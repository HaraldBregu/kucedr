import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOnboarding } from '@/contexts/useOnboarding';
import { usePrivacy } from '@/hooks/privacy';

export function StartupGate({ children }: { readonly children: ReactNode }): React.JSX.Element {
	const { phase } = useOnboarding();
	const location = useLocation();
	const { state: privacy } = usePrivacy();
	const onboardingPath =
		location.pathname === '/' ||
		location.pathname === '/start' ||
		location.pathname === '/auth' ||
		location.pathname === '/setup' ||
		location.pathname === '/config';
	const applicationPath = !onboardingPath;

	if (location.pathname === '/settings/privacy' && privacy && (privacy.status !== 'off' || privacy.restartRequired)) {
		return <>{children}</>;
	}

	if (applicationPath && phase === 'checking') {
		return <div className="h-screen bg-background" aria-label="Loading application" />;
	}

	if (applicationPath && phase === 'ready') {
		return <>{children}</>;
	}

	if (phase !== 'ready') {
		return location.pathname === '/start' ? (
			<>{children}</>
		) : (
			<Navigate to="/start" replace state={applicationPath ? { from: location.pathname } : undefined} />
		);
	}

	if (onboardingPath) {
		const from = (location.state as { from?: string } | null)?.from;
		return <Navigate to={from ?? '/home'} replace />;
	}

	return <>{children}</>;
}
