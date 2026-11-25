import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Pencil, Trash2 } from 'lucide-react';
import type { MemoryEntry } from '@shared/memory_types';
import { Button } from '@/components/ui/button';
import { useChatSession } from '@/contexts/chat-session';
import { SettingsEmptyState, SettingsPanel, SettingsRow, SettingsSection } from '../../components';
import { EditDialog } from '../browser/EditDialog';

export function Remembered(): React.JSX.Element {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { setSessionId } = useChatSession();
	const [entries, setEntries] = useState<MemoryEntry[] | null>(null);
	const [chats, setChats] = useState<Map<string, string>>(new Map());
	const [editing, setEditing] = useState<MemoryEntry | null>(null);
	const [error, setError] = useState<string | null>(null);
	const fail = (failure: unknown): void =>
		setError(failure instanceof Error ? failure.message : String(failure));
	const reload = (): void => {
		void window.memory.list().then(setEntries).catch(fail);
	};
	useEffect(() => {
		reload();
		void window.agent
			.listSessions(true)
			.then((sessions) => setChats(new Map(sessions.map((session) => [session.id, session.title]))))
			.catch(() => undefined);
	}, []);
	return (
		<SettingsSection
			title={t('settings.memory.remembered')}
			description={t('settings.memory.rememberedDescription')}
		>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<SettingsPanel>
				{entries?.length === 0 ? (
					<SettingsEmptyState icon={BrainCircuit} title={t('settings.memory.rememberedEmpty')} />
				) : null}
				{entries?.map((entry) => {
					const chat = entry.source ? chats.get(entry.source) : undefined;
					return (
						<SettingsRow
							key={entry.id}
							title={entry.fact}
							description={
								<>
									{[entry.section, entry.createdAt && new Date(entry.createdAt).toLocaleDateString()]
										.filter(Boolean)
										.join(' · ')}
									{entry.source ? (entry.section || entry.createdAt ? ' · ' : '') : null}
									{entry.source && chat !== undefined ? (
										<Button
											type="button"
											variant="link"
											className="h-auto p-0 text-xs"
											onClick={() => {
												setSessionId(entry.source!);
												navigate('/home');
											}}
										>
											{t('settings.memory.fromChat', { title: chat || t('common.untitled') })}
										</Button>
									) : entry.source ? (
										t('settings.memory.fromEarlierChat')
									) : null}
								</>
							}
							actionClassName="w-auto justify-end gap-1"
							actions={
								<>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={t('common.edit')}
										title={t('common.edit')}
										onClick={() => setEditing(entry)}
									>
										<Pencil />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={t('common.delete')}
										title={t('common.delete')}
										onClick={() => {
											setError(null);
											void window.memory.forget(entry.id).then(reload).catch(fail);
										}}
									>
										<Trash2 />
									</Button>
								</>
							}
						/>
					);
				})}
			</SettingsPanel>
			<EditDialog
				title={t('settings.memory.editFact')}
				description={t('settings.memory.editFactDescription')}
				fields={[{ name: 'fact', label: t('settings.memory.fact') }]}
				values={editing ? { fact: editing.fact } : null}
				onClose={() => setEditing(null)}
				onSave={async (values) => {
					if (!editing) return;
					await window.memory.update(editing.id, values.fact ?? '');
					reload();
				}}
			/>
		</SettingsSection>
	);
}
