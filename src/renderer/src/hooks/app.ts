import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { App } from '@shared/installed_app_types';
import type { OpenExtension } from '@/pages/home/components/ExtensionPage';

/** Opens an app in its manifest mode (extension by default). */
export function useOpenApp(): (app: App) => Promise<void> {
	const navigate = useNavigate();
	const location = useLocation();
	return useCallback(
		async (app) => {
			if (app.mode === 'window') {
				return window.apps.open(app.id);
			}
			const detail: OpenExtension = {
				id: app.id,
				title: app.title,
				entry: app.metadata.entry,
				icon: app.imageUrl,
			};
			if (location.pathname === '/home') {
				window.dispatchEvent(new CustomEvent<OpenExtension>('kucedr:open-extension', { detail }));
				return;
			}
			navigate('/home', { state: { openExtension: detail } });
		},
		[location.pathname, navigate]
	);
}
