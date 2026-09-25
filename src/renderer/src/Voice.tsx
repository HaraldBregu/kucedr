import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadModels } from './lib/providers';
import { VoiceConversationWindow } from './components/voice-conversation-window';
import { useWindowRadius } from './hooks/useWindowRadius';
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
const root = createRoot(rootElement);

function VoiceRoot(): React.JSX.Element {
	useWindowRadius();
	return <VoiceConversationWindow chatSessionId={chatSessionId} />;
}

const render = (): void => {
	root.render(
		<StrictMode>
			<VoiceRoot />
		</StrictMode>
	);
};

void loadModels()
	.catch(() => undefined)
	.finally(render);
