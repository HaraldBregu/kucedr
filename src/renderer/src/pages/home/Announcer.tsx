import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { HomeChatMessage } from './context/state';
import { isToolRunning, toolPartLabel } from './components/tool-label';

export function Announcer({
	message,
	loading,
}: {
	message?: HomeChatMessage;
	loading: boolean;
}): ReactElement {
	const { t } = useTranslation();
	const [ran, setRan] = useState(false);
	useEffect(() => {
		if (loading) setRan(true);
	}, [loading]);
	const reply = message?.role === 'agent' ? message : undefined;
	const tool = reply?.tools.findLast(isToolRunning);
	let text = '';
	if (loading) {
		if (tool) text = toolPartLabel(tool);
		else if (reply?.state === 'awaiting_input') text = t('chat.announce.awaiting', 'Waiting for your answer');
		else text = t('chat.announce.responding', 'Kucedr is responding');
	} else if (ran && reply?.state === 'error') {
		text = t('chat.announce.failed', { error: reply.errorText ?? '', defaultValue: 'Reply failed. {{error}}' });
	} else if (ran && reply?.state === 'cancelled') {
		text = t('chat.announce.stopped', 'Reply stopped');
	} else if (ran) {
		text = t('chat.announce.complete', 'Reply complete');
	}
	return (
		<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
			{text}
		</span>
	);
}
