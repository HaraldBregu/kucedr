import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@excalidraw/excalidraw/index.css';
import 'tldraw/tldraw.css';
import App from './App';
import './styles.css';

type ExcalidrawWindow = Window & {
	EXCALIDRAW_ASSET_PATH?: string | string[];
};

(window as ExcalidrawWindow).EXCALIDRAW_ASSET_PATH = new URL('./', window.location.href).toString();

createRoot(document.getElementById('root') as HTMLElement).render(
	<StrictMode>
		<App />
	</StrictMode>
);
