import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { isAgentToolAllowedForProfile } from '@shared/agent_tools';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
	SettingsField,
	SettingsLoadingRows,
	SettingsNotice,
	SettingsPageHeader,
	SettingsPageShell,
	SettingsPanel,
	SettingsRow,
	SettingsSection,
} from '../../../components';
import { ORDERED_AGENT_TOOL_GROUPS } from '../../assistant/tools/groups';
import { describeSchedule } from '../schedule';

const TOOLS = ORDERED_AGENT_TOOL_GROUPS.filter((group) => group.titleKey !== 'tasks').flatMap(
	(group) =>
		[
			...(group.titleKey === 'web' ? [['Search web', 'search_web', 'Searches the web.'] as const] : []),
			...group.tools,
		]
			.filter(([, id]) => isAgentToolAllowedForProfile('tasks', { kind: 'builtin', id }))
			.map(([name, id, description]) => ({ name, id, description, icon: group.icon }))
);

const TaskEditPage: React.FC = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { taskId } = useParams<{ taskId: string }>();
	const id = taskId ? decodeURIComponent(taskId) : undefined;
	const [name, setName] = useState('');
	const [prompt, setPrompt] = useState('');
	const [cronExpression, setCronExpression] = useState('');
	const [toolsAllow, setToolsAllow] = useState<string[]>([]);
	const [catchUp, setCatchUp] = useState(false);
	const [loading, setLoading] = useState(id !== undefined);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!id) return;
		void window.tasks
			.list()
			.then((tasks) => {
				const task = tasks.find((item) => item.id === id);
				if (!task) throw new Error(t('settings.cron.notFoundDescription'));
				setName(task.name);
				setPrompt(task.prompt);
				setCronExpression(task.cronExpression ?? '');
				setToolsAllow(task.toolsAllow ?? []);
				setCatchUp(task.catchUp === true);
			})
			.catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))
			.finally(() => setLoading(false));
	}, [id, t]);

	const save = async (): Promise<void> => {
		setSaving(true);
		setError(null);
		try {
			const request = { name, prompt, cronExpression, toolsAllow };
			const task = id
				? await window.tasks.update(id, request)
				: await window.tasks.create(request);
			navigate(`/settings/tasks/${encodeURIComponent(task.id)}/detail`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : t('settings.cron.form.saveError'));
			setSaving(false);
		}
	};

	return (
		<SettingsPageShell>
			<SettingsPageHeader
				title={t(id ? 'settings.cron.form.editTitle' : 'settings.cron.form.newTitle')}
				description={t('settings.cron.form.description')}
			/>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}
			{loading ? (
				<SettingsLoadingRows rows={3} />
			) : (
				<form
					className="flex flex-col gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						if (!saving) void save();
					}}
				>
					<fieldset disabled={saving} className="flex min-w-0 flex-col gap-6">
						<Card size="sm" className="grid gap-4 p-4!">
							<SettingsField id="task-name" label={t('settings.cron.form.name')}>
								<Input
									id="task-name"
									required
									autoFocus
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</SettingsField>
							<SettingsField id="task-prompt" label={t('settings.cron.form.instructions')}>
								<Textarea
									id="task-prompt"
									required
									className="min-h-28"
									placeholder={t('settings.cron.form.instructionsPlaceholder')}
									value={prompt}
									onChange={(event) => setPrompt(event.target.value)}
								/>
							</SettingsField>
							<SettingsField
								id="task-schedule"
								label={t('settings.cron.form.schedule')}
								description={t('settings.cron.form.scheduleHint')}
							>
								<Input
									id="task-schedule"
									spellCheck={false}
									placeholder="0 9 * * *"
									aria-describedby="task-schedule-description task-schedule-words"
									value={cronExpression}
									onChange={(event) => setCronExpression(event.target.value)}
								/>
								<p id="task-schedule-words" className="text-xs leading-4 text-foreground">
									{describeSchedule(cronExpression.trim(), t)}
								</p>
							</SettingsField>
						</Card>
						<SettingsPanel>
							<SettingsRow
								title={t('settings.cron.form.catchUp')}
								description={t('settings.cron.form.catchUpDescription')}
								actions={
									<Switch
										aria-label={t('settings.cron.form.catchUp')}
										checked={catchUp}
										onCheckedChange={setCatchUp}
									/>
								}
							/>
						</SettingsPanel>
						<SettingsSection
							title={t('settings.cron.form.tools')}
							description={t('settings.cron.form.toolsDescription')}
						>
							<SettingsPanel>
								{TOOLS.map((tool) => (
									<SettingsRow
										key={tool.id}
										icon={tool.icon}
										title={tool.name}
										description={tool.description}
										actionClassName="w-auto justify-end"
										actions={
											<Checkbox
												aria-label={tool.name}
												checked={toolsAllow.includes(tool.id)}
												onCheckedChange={(checked) =>
													setToolsAllow((current) =>
														checked
															? [...current, tool.id]
															: current.filter((item) => item !== tool.id)
													)
												}
											/>
										}
									/>
								))}
							</SettingsPanel>
						</SettingsSection>
					</fieldset>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => navigate(-1)}>
							{t('common.cancel')}
						</Button>
						<Button type="submit" size="sm" disabled={saving || !name.trim() || !prompt.trim()}>
							{saving ? t('settings.cron.form.saving') : t('common.save')}
						</Button>
					</div>
				</form>
			)}
		</SettingsPageShell>
	);
};

export default TaskEditPage;
