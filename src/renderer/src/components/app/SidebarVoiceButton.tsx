import { AudioLines } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatSession } from '@/contexts/chat-session';
import { ensureAppMicrophoneAccess } from '@/pages/home/hooks/audio';

export function SidebarVoiceButton(): React.JSX.Element {
	const { t } = useTranslation();
	const { sessionId } = useChatSession();
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const label = voiceError ?? t('settings.tabs.voice');

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="absolute right-20 top-1 z-10 shrink-0 rounded-md hover:bg-sidebar-primary hover:text-sidebar-primary-foreground dark:hover:bg-sidebar-primary"
						aria-label={t('settings.tabs.voice')}
						onClick={() => {
							setVoiceError(null);
							void ensureAppMicrophoneAccess()
								.then(() => window.win.openVoiceConversation(sessionId))
								.catch((error: unknown) => {
									setVoiceError(
										error instanceof Error && error.message.trim()
										? error.message
										: 'Voice could not be opened.'
									);
								});
						}}
					>
						<AudioLines className="size-4" strokeWidth={1.8} />
					</Button>
				}
			/>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
