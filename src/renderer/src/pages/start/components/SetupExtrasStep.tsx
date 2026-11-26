import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { SetupPluginsStep } from './SetupPluginsStep';
import { SetupVoiceStep } from './SetupVoiceStep';
import type { SetupAssistantProps } from './SetupService';

export function SetupExtrasStep(props: SetupAssistantProps): React.JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col pt-8">
			<Tabs defaultValue="plugins" className="flex min-h-0 flex-1 flex-col">
				<TabsList>
					<TabsTrigger value="plugins">{t('start.extras.plugins')}</TabsTrigger>
					<TabsTrigger value="voice">{t('start.extras.voice')}</TabsTrigger>
				</TabsList>
				<TabsContent value="plugins" className="min-h-0 flex-1">
					<SetupPluginsStep />
				</TabsContent>
				<TabsContent value="voice" className="min-h-0 flex-1">
					<SetupVoiceStep {...props} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
