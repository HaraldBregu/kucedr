import type { ReactElement } from 'react';
import { Download, X } from 'lucide-react';
import type { BrowserDownload } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';

export function BrowserDownloadBar({
	download,
	onAnswer,
}: {
	readonly download: BrowserDownload;
	readonly onAnswer: (answer: 'save' | 'cancel' | 'dismiss' | 'show') => void;
}): ReactElement {
	const running = download.state === 'asking' || download.state === 'saving';
	return (
		<div role="region" aria-label="Download" className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs">
			<Download className="size-4 shrink-0 text-muted-foreground" />
			<p className="min-w-0 flex-1 truncate" role="status">
				{download.state === 'asking' ? (
					<>
						Download <span className="font-medium">{download.file}</span>
						{download.site ? ` from ${download.site}` : ''}?
					</>
				) : download.state === 'saving' ? (
					<>
						Downloading <span className="font-medium">{download.file}</span>…
					</>
				) : download.state === 'done' ? (
					<>
						Saved <span className="font-medium">{download.file}</span> to Downloads.
					</>
				) : (
					<>
						<span className="font-medium">{download.file}</span> could not be downloaded.
					</>
				)}
			</p>
			{download.state === 'asking' ? (
				<Button type="button" size="sm" onClick={() => onAnswer('save')}>
					Download
				</Button>
			) : null}
			{download.state === 'done' ? (
				<Button type="button" size="sm" variant="ghost" onClick={() => onAnswer('show')}>
					Show in folder
				</Button>
			) : null}
			<Button
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={running ? 'Cancel download' : 'Close'}
				title={running ? 'Cancel download' : 'Close'}
				onClick={() => onAnswer(running ? 'cancel' : 'dismiss')}
			>
				<X />
			</Button>
		</div>
	);
}
