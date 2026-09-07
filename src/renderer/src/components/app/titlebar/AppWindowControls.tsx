import { Copy, Minus, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppWindowControlsProps {
	isMaximized: boolean;
}

export function AppWindowControls({
	isMaximized,
}: AppWindowControlsProps): React.JSX.Element {
	return (
		<div
			className="z-10 flex h-full items-center"
			style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-full w-[46px] rounded-none text-muted-foreground hover:bg-accent/80 hover:text-foreground"
				onClick={() => window.win.minimize()}
				title="Minimize"
				aria-label="Minimize"
			>
				<Minus className="size-[13px]" strokeWidth={1.5} />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-full w-[46px] rounded-none text-muted-foreground hover:bg-accent/80 hover:text-foreground"
				onClick={() => window.win.maximize()}
				title={isMaximized ? 'Restore' : 'Maximize'}
				aria-label={isMaximized ? 'Restore' : 'Maximize'}
			>
				{isMaximized ? (
					<Copy className="size-[11px]" strokeWidth={1.5} />
				) : (
					<Square className="size-[11px]" strokeWidth={1.5} />
				)}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-full w-[46px] rounded-none text-muted-foreground hover:bg-[#e81123] hover:text-white active:bg-[#c42b1c] active:text-white"
				onClick={() => window.win.close()}
				title="Close"
				aria-label="Close"
			>
				<X className="size-[13px]" strokeWidth={1.5} />
			</Button>
		</div>
	);
}
