import type { ReactElement } from 'react';
import { Bell, Camera, MapPin, Mic, X } from 'lucide-react';
import type { BrowserPermissionRequest } from '../../../../../shared/browser';
import { Button } from '@/components/ui/button';

const WANTS = {
	camera: 'use your camera',
	microphone: 'use your microphone',
	location: 'know your location',
	notifications: 'show notifications',
} as const;

export function BrowserPermissionBar({
	permission,
	onAnswer,
}: {
	readonly permission: BrowserPermissionRequest;
	readonly onAnswer: (answer: 'allow' | 'block' | 'dismiss') => void;
}): ReactElement {
	const kind = permission.kinds[0];
	const Icon = kind === 'camera' ? Camera : kind === 'microphone' ? Mic : kind === 'location' ? MapPin : Bell;
	const wants =
		permission.kinds.length > 1 ? 'use your camera and microphone' : WANTS[kind];
	return (
		<div role="region" aria-label="Site permission" className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs">
			<Icon className="size-4 shrink-0 text-muted-foreground" />
			<p className="min-w-0 flex-1 truncate" role="status">
				<span className="font-medium">{permission.site}</span> wants to {wants}.
			</p>
			<Button type="button" size="sm" variant="outline" onClick={() => onAnswer('block')}>
				Block
			</Button>
			<Button type="button" size="sm" onClick={() => onAnswer('allow')}>
				Allow
			</Button>
			<Button
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label="Close"
				title="Close"
				onClick={() => onAnswer('dismiss')}
			>
				<X />
			</Button>
		</div>
	);
}
