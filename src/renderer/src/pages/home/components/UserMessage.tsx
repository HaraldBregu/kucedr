import { useState, type FormEvent, type ReactElement } from 'react';
import { ArrowUp, Copy, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/prompt-kit/markdown';
import { Message, MessageActions } from '@/components/prompt-kit/message';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { userMarkdownComponents } from './markdown';

export function UserMessage({
	content,
	canEdit = true,
	onEdit,
}: {
	readonly content: string;
	readonly canEdit?: boolean;
	readonly onEdit?: (content: string) => Promise<boolean>;
}): ReactElement | null {
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [draft, setDraft] = useState(content);
	const [editError, setEditError] = useState<string | null>(null);
	if (!content.trim()) return null;

	const copyMessage = (): void => {
		void (async () => {
			if (navigator.clipboard?.writeText) {
				const copied = await navigator.clipboard.writeText(content).then(
					() => true,
					() => false
				);
				if (copied) return;
			}

			const textarea = document.createElement('textarea');
			textarea.value = content;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.left = '-9999px';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		})();
	};

	const submitEdit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
		event.preventDefault();
		const nextContent = draft.trim();
		if (!nextContent || isSaving || !onEdit) return;
		if (nextContent === content) {
			setIsEditing(false);
			return;
		}

		setIsSaving(true);
		setEditError(null);
		try {
			if (await onEdit(nextContent)) setIsEditing(false);
			else setEditError('Could not save changes.');
		} catch {
			setEditError('Could not save changes.');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Message className="w-full justify-end">
			<div className="flex min-w-0 max-w-[75%] flex-col items-end gap-1">
				{isEditing ? (
					<form
						className="w-[min(36rem,75vw)] max-w-full rounded-xl border border-input bg-background p-2 shadow-sm"
						aria-label="Edit message"
						onSubmit={(event) => void submitEdit(event)}
					>
						<Textarea
							autoFocus
							value={draft}
							aria-label="Edit message text"
							className="max-h-60 min-h-24 resize-y border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
							disabled={isSaving}
							onChange={(event) => setDraft(event.target.value)}
						/>
						<div className="flex items-center justify-between gap-2 pt-2">
							{editError ? (
								<span className="text-xs text-destructive" role="alert">
									{editError}
								</span>
							) : (
								<span />
							)}
							<div className="flex items-center gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label="Cancel edit"
									title="Cancel edit"
									disabled={isSaving}
									onClick={() => {
										setDraft(content);
										setEditError(null);
										setIsEditing(false);
									}}
								>
									<X className="size-4" />
								</Button>
								<Button
									type="submit"
									size="icon-sm"
									className="rounded-full"
									aria-label="Submit edit"
									title="Submit edit"
									disabled={isSaving || !draft.trim()}
								>
									<ArrowUp className="size-4" />
								</Button>
							</div>
						</div>
					</form>
				) : (
					<div
						data-slot="user-message-content"
						className="relative min-w-0 w-fit max-w-full overflow-hidden rounded-xl bg-primary"
					>
						<Markdown
						className="min-w-0 max-w-full break-words px-5 py-3 text-sm font-medium leading-relaxed text-primary-foreground [overflow-wrap:anywhere] selection:bg-primary-foreground selection:text-primary"
							components={userMarkdownComponents}
						>
							{content}
						</Markdown>
					</div>
				)}
				{!isEditing ? (
					<MessageActions className="gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="text-muted-foreground hover:text-foreground"
							aria-label="Copy message"
							title="Copy message"
							onClick={copyMessage}
						>
							<Copy className="size-3.5" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="text-muted-foreground hover:text-foreground"
							aria-label="Edit message"
							title="Edit message"
							disabled={!canEdit || !onEdit}
							onClick={() => {
								setDraft(content);
								setEditError(null);
								setIsEditing(true);
							}}
						>
							<Pencil className="size-3.5" />
						</Button>
					</MessageActions>
				) : null}
			</div>
		</Message>
	);
}
