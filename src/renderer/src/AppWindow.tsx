import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './components/app/titlebar/AppShell';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Impossible to find the app root element');

createRoot(rootElement).render(
	<StrictMode>
		<AppShell />
	</StrictMode>
);
