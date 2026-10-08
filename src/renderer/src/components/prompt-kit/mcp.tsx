import { Plug } from 'lucide-react';
import { mcps } from '@/lib/providers';
import { cn } from '@/lib/utils';
import type { ToolPart } from './tool';

export function McpIcon({
	toolPart,
	className,
}: {
	readonly toolPart?: ToolPart;
	readonly className?: string;
}) {
	const serviceId =
		toolPart?.serviceId?.toLowerCase() ?? toolPart?.type.toLowerCase().match(/^mcp__(.*?)__/)?.[1];
	const service = mcps().find((entry) => entry.id.toLowerCase() === serviceId);
	const light =
		service?.iconLightUrl ??
		service?.iconDarkUrl ??
		service?.provider.iconLightUrl ??
		service?.provider.iconDarkUrl;
	const dark =
		service?.iconDarkUrl ??
		service?.iconLightUrl ??
		service?.provider.iconDarkUrl ??
		service?.provider.iconLightUrl;
	if (!light || !dark) return <Plug className={className} />;

	return (
		<span className={cn('inline-flex', className)}>
			<img
				src={light}
				alt=""
				aria-hidden="true"
				draggable={false}
				className="size-full object-contain dark:hidden"
			/>
			<img
				src={dark}
				alt=""
				aria-hidden="true"
				draggable={false}
				className="hidden size-full object-contain dark:block"
			/>
		</span>
	);
}
