import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadModels } from './lib/providers';
import { VoiceConversationWindow } from './components/voice-conversation-window';
import './i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Impossible to find the voice window root element');

function chatSessionIdFromHash(): string {
	const encoded = window.location.hash.replace(/^#\/?voice\//, '');
	if (!encoded) throw new Error('Voice conversation session id is missing.');
	return decodeURIComponent(encoded);
}

const chatSessionId = chatSessionIdFromHash();

createRoot(rootElement).render(
	<StrictMode>
		<VoiceConversationWindow chatSessionId={chatSessionId} />
	</StrictMode>
);

void loadModels().then(() => window.location.reload()).catch(() => undefined);
