import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { CoderPage } from './coder/Page';
import './i18n';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Coder root element is missing.');
const router = createHashRouter([{ path: '/*', element: <CoderPage /> }]);
createRoot(root).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>
);
