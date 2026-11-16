import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AppProvider, AuthProvider, OnboardingProvider } from './contexts';
import { ErrorBoundary } from './components/app/base/ErrorBoundary';
import { initRecorderCapture } from './lib/recorder';
import { router } from './router';
import { Provider as PageProvider } from './components/app/base/page';
import { useMouseNavigation } from './hooks/mouse';
import { useZoom } from './hooks/zoom';
import { useAppTheme } from './components/app/navigationbar/hooks/useAppTheme';
import './index.css';

const App: React.FC = () => {
	useEffect(() => initRecorderCapture(), []);
	useMouseNavigation();
	useZoom();
	useAppTheme();

	return (
		<ErrorBoundary level="root">
			<AppProvider>
				<AuthProvider>
					<OnboardingProvider>
						<PageProvider>
							<RouterProvider router={router} />
						</PageProvider>
					</OnboardingProvider>
				</AuthProvider>
			</AppProvider>
		</ErrorBoundary>
	);
};

export default App;
