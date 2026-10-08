import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

export function ImageGallery({
	paths,
	toSource,
	onContextMenu,
}: {
	readonly paths: readonly string[];
	readonly toSource: (path: string) => string;
	readonly onContextMenu: (path: string) => void;
}): ReactElement | null {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const index = paths[selectedIndex] ? selectedIndex : 0;
	const selectedPath = paths[index];
	if (!selectedPath) return null;

	if (paths.length === 1) {
		return (
			<img
				src={toSource(selectedPath)}
				alt="Generated image"
				className="h-auto max-w-full rounded-lg border border-border/50"
				onContextMenu={() => onContextMenu(selectedPath)}
			/>
		);
	}

	return (
		<div className="flex w-full min-w-0 flex-col items-start gap-2" aria-label="Generated images">
			<img
				src={toSource(selectedPath)}
				alt={`Generated image ${index + 1} of ${paths.length}`}
				className="h-auto max-w-full rounded-lg border border-border/50"
				onContextMenu={() => onContextMenu(selectedPath)}
			/>
			<div className="flex max-w-full flex-wrap justify-start gap-2" aria-label="Choose generated image">
				{paths.map((path, pathIndex) => (
					<button
						key={path}
						type="button"
						className={cn(
							'aspect-square w-16 shrink-0 overflow-hidden rounded-lg border bg-muted transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							pathIndex === index
								? 'border-border/50'
								: 'border-border/50 brightness-50 hover:border-foreground/50 hover:brightness-75'
						)}
						aria-label={`Show generated image ${pathIndex + 1} of ${paths.length}`}
						aria-pressed={pathIndex === index}
						onClick={() => setSelectedIndex(pathIndex)}
						onContextMenu={() => onContextMenu(path)}
					>
						<img src={toSource(path)} alt="" className="size-full object-cover" />
					</button>
				))}
			</div>
		</div>
	);
}
