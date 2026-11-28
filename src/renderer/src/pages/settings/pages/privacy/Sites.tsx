import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CommandSites } from '@shared/sites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsNotice, SettingsPanel, SettingsRow, SettingsSection } from '../../components';

export function Sites(): React.JSX.Element {
	const { t } = useTranslation();
	const [sites, setSites] = useState<CommandSites | null>(null);
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		void window.app.getSites().then(
			(result) => {
				if (active) setSites(result);
			},
			() => {
				if (active) setError(t('settings.privacy.sites.loadFailed'));
			}
		);
		return () => {
			active = false;
		};
	}, [t]);

	const save = async (next: CommandSites): Promise<boolean> => {
		setError(null);
		try {
			setSites(await window.app.setSites(next));
			return true;
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('settings.privacy.sites.saveFailed'));
			return false;
		}
	};

	const add = async (): Promise<void> => {
		if (!sites || !draft.trim()) return;
		if (await save({ ...sites, hosts: [...sites.hosts, draft] })) setDraft('');
	};

	return (
		<SettingsSection title={t('settings.privacy.sites.title')} description={t('settings.privacy.sites.description')}>
			{sites && (
				<SettingsPanel>
					<SettingsRow
						title={t('settings.privacy.sites.strict')}
						description={t('settings.privacy.sites.strictDescription')}
						actions={
							<Switch
								aria-label={t('settings.privacy.sites.strict')}
								checked={sites.strict}
								onCheckedChange={(strict) => void save({ ...sites, strict })}
							/>
						}
					/>
					{sites.hosts.map((host) => (
						<SettingsRow
							key={host}
							title={host}
							actions={
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={t('settings.privacy.sites.remove', { host })}
									onClick={() => void save({ ...sites, hosts: sites.hosts.filter((item) => item !== host) })}
								>
									<X />
								</Button>
							}
						/>
					))}
					<SettingsRow
						title={t('settings.privacy.sites.add')}
						actions={
							<form
								className="flex gap-2"
								onSubmit={(event) => {
									event.preventDefault();
									void add();
								}}
							>
								<Input
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									placeholder="example.com"
									aria-label={t('settings.privacy.sites.add')}
									className="w-48"
								/>
								<Button type="submit" variant="outline" disabled={!draft.trim()}>
									{t('settings.privacy.sites.addAction')}
								</Button>
							</form>
						}
					/>
				</SettingsPanel>
			)}
			{error && <SettingsNotice variant="destructive">{error}</SettingsNotice>}
		</SettingsSection>
	);
}
