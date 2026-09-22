import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadModels } from './lib/providers';
import './i18n';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Impossible to find the root element');
}

const root = createRoot(rootElement);

const render = (): void => {
	root.render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
};

render();
void loadModels().then(render).catch(() => undefined);
window.app.onModelsChanged(() => void loadModels().then(render).catch(() => undefined));
