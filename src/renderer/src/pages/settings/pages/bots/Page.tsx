import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, Wrench } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
} from '../../components';

const BOT_PROVIDERS = [
	{ id: 'telegram', label: 'Telegram' },
	{ id: 'discord', label: 'Discord' },
	{ id: 'slack', label: 'Slack' },
] as const;

type BotProviderId = (typeof BOT_PROVIDERS)[number]['id'];

const BotsPage: React.FC = () => {
	const { t } = useTranslation();
	// ponytail: local state only, wire to a main-process store when bots run for real
	const [bot, setBot] = useState({
		enabled: false,
		name: '',
		provider: 'telegram' as BotProviderId,
		token: '',
	});

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t('settings.tabs.bots')}
				description={t('settings.overview.descriptions.bots')}
			/>

			<SettingsPanel>
				<SettingsRow
					title={t('settings.bots.fields.enabled')}
					actions={
						<Switch
							checked={bot.enabled}
							onCheckedChange={(enabled) => setBot({ ...bot, enabled })}
							aria-label={t('settings.bots.fields.enabled')}
						/>
					}
				/>
				<SettingsRow
					title={t('settings.bots.fields.name')}
					actions={
						<Input
							id="bot-name"
							value={bot.name}
							onChange={(event) => setBot({ ...bot, name: event.target.value })}
							placeholder={t('settings.bots.fields.namePlaceholder')}
							className="h-7 w-44 text-xs"
						/>
					}
				/>
				<SettingsRow
					title={t('settings.bots.fields.provider')}
					description={t('settings.bots.fields.providerDescription')}
					actions={
						<Select
							value={bot.provider}
							onValueChange={(value) =>
								setBot({ ...bot, provider: (value ?? 'telegram') as BotProviderId })
							}
						>
							<SelectTrigger id="bot-provider" className="h-7 w-44 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{BOT_PROVIDERS.map((provider) => (
									<SelectItem key={provider.id} value={provider.id}>
										{provider.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
				<SettingsRow
					title={t('settings.bots.fields.token')}
					className="border-b-0"
					actions={
						<Input
							id="bot-token"
							type="password"
							autoComplete="off"
							value={bot.token}
							onChange={(event) => setBot({ ...bot, token: event.target.value })}
							className="h-7 w-44 text-xs"
						/>
					}
				/>
			</SettingsPanel>

			<SettingsPanel>
				<Link to="/settings/bots/tools" className="block hover:bg-muted/40">
					<SettingsRow
						title={t('settings.modelServices.tools')}
						description={t('settings.modelServices.toolsDescription')}
						media={<Wrench className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
						className="grid-cols-[minmax(0,1fr)_auto] border-b-0"
						actionClassName="w-auto justify-end"
						actions={<ChevronRight className="size-4 text-muted-foreground" />}
					/>
				</Link>
			</SettingsPanel>
		</SettingsPageShell>
	);
};

export default BotsPage;
