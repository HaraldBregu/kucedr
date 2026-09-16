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
		<div
			className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_4rem] gap-2"
			aria-label="Generated images"
		>
			<div className="aspect-video min-w-0">
				<img
					src={toSource(selectedPath)}
					alt={`Generated image ${index + 1} of ${paths.length}`}
					className="size-full rounded-lg border border-border/50 object-cover"
					onContextMenu={() => onContextMenu(selectedPath)}
				/>
			</div>
			<div className="relative min-h-0">
				<div
					className="absolute inset-0 flex flex-col gap-2 overflow-y-auto"
					aria-label="Choose generated image"
				>
					{paths.map((path, pathIndex) => (
						<button
							key={path}
							type="button"
							className={cn(
								'shrink-0 overflow-hidden rounded-lg border bg-muted transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
								pathIndex === index
									? 'border-border/50'
									: 'border-border/50 brightness-50 hover:border-foreground/50 hover:brightness-75'
							)}
							aria-label={`Show generated image ${pathIndex + 1} of ${paths.length}`}
							aria-pressed={pathIndex === index}
							onClick={() => setSelectedIndex(pathIndex)}
							onContextMenu={() => onContextMenu(path)}
						>
							<img src={toSource(path)} alt="" className="aspect-square w-full object-cover" />
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
