import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CoderPage } from './coder/Page';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Coder root element is missing.');
createRoot(root).render(
	<StrictMode>
		<CoderPage />
	</StrictMode>
);
