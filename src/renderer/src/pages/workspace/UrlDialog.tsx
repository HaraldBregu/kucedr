import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface WorkspaceUrlDialogProps {
	readonly onClose: () => void;
	readonly onInsert: (url: string, alt: string) => void;
}

export function WorkspaceUrlDialog({ onClose, onInsert }: WorkspaceUrlDialogProps): React.JSX.Element {
	const [url, setUrl] = useState('');
	const [alt, setAlt] = useState('');
	const valid = URL.canParse(url.trim()) && new URL(url.trim()).protocol === 'https:';
	return (
		<Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
			<DialogContent showCloseButton={false}>
				<form className="grid gap-4" onSubmit={(event) => {
					event.preventDefault();
					if (valid) onInsert(url.trim(), alt.trim());
				}}>
					<DialogHeader>
						<DialogTitle>Insert image from URL</DialogTitle>
						<DialogDescription>The image stays online and is linked, not downloaded.</DialogDescription>
					</DialogHeader>
					<Input autoFocus aria-label="Image URL" placeholder="https://example.com/image.png" value={url} onChange={(event) => setUrl(event.target.value)} />
					<Input aria-label="Description" placeholder="Description (optional)" value={alt} onChange={(event) => setAlt(event.target.value)} />
					{url.trim() && !valid ? <p className="text-sm text-destructive" role="alert">Enter a valid https:// URL.</p> : null}
					{valid ? <img src={url.trim()} alt="" className="max-h-48 justify-self-center rounded-md object-contain" /> : null}
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
						<Button type="submit" disabled={!valid}>Insert</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
