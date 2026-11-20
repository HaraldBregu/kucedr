import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SettingsField, SettingsNotice } from '../../components';

export interface EditField {
	readonly name: string;
	readonly label: string;
	readonly type?: 'text' | 'url' | 'password';
	readonly placeholder?: string;
}

export function EditDialog({
	title,
	description,
	fields,
	values,
	onClose,
	onSave,
}: {
	readonly title: string;
	readonly description?: string;
	readonly fields: readonly EditField[];
	readonly values: Record<string, string> | null;
	readonly onClose: () => void;
	readonly onSave: (values: Record<string, string>) => Promise<void>;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [draft, setDraft] = useState<Record<string, string>>({});
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);
	useEffect(() => {
		setDraft(values ?? {});
		setError('');
	}, [values]);
	return (
		<Dialog open={values !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? <DialogDescription>{description}</DialogDescription> : null}
				</DialogHeader>
				<form
					className="space-y-4"
					onSubmit={async (event) => {
						event.preventDefault();
						setSaving(true);
						try {
							await onSave(draft);
							onClose();
						} catch (reason) {
							setError(reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(reason));
						} finally {
							setSaving(false);
						}
					}}
				>
					{fields.map((field, index) => (
						<SettingsField key={field.name} id={`edit-${field.name}`} label={field.label}>
							<Input
								id={`edit-${field.name}`}
								autoFocus={index === 0}
								type={field.type ?? 'text'}
								autoComplete={field.type === 'password' ? 'new-password' : 'off'}
								placeholder={field.placeholder}
								value={draft[field.name] ?? ''}
								onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))}
							/>
						</SettingsField>
					))}
					{error ? <SettingsNotice variant="destructive">{error}</SettingsNotice> : null}
					<DialogFooter className="border-0 bg-transparent p-0">
						<Button type="button" variant="outline" onClick={onClose}>
							{t('common.cancel')}
						</Button>
						<Button type="submit" disabled={saving}>
							{t('common.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
