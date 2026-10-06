import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadModels } from './lib/providers';
import { VoiceWindow } from './components/voice-window';
import { AppProvider } from './contexts';
import './i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Impossible to find the voice window root element');

function chatSessionIdFromHash(): string {
	const encoded = window.location.hash.replace(/^#\/?voice\//, '');
	if (!encoded) throw new Error('Voice session id is missing.');
	return decodeURIComponent(encoded);
}

const chatSessionId = chatSessionIdFromHash();
const root = createRoot(rootElement);

const render = (): void => {
	root.render(
		<StrictMode>
			<AppProvider>
				<VoiceWindow chatSessionId={chatSessionId} />
			</AppProvider>
		</StrictMode>
	);
};

void loadModels()
	.catch(() => undefined)
	.finally(render);
