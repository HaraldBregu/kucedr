import { MoveHorizontal, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface WorkspaceViewActionsProps {
	readonly wide: boolean;
	readonly onWideChange: (wide: boolean) => void;
	readonly onFind: () => void;
}

export function WorkspaceViewActions({ wide, onWideChange, onFind }: WorkspaceViewActionsProps): React.JSX.Element {
	return (
		<div className="ml-auto flex items-center gap-0.5">
			<Tooltip>
				<TooltipTrigger render={
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Find in file" className="text-muted-foreground" onMouseDown={(event) => event.preventDefault()} onClick={onFind}>
						<Search />
					</Button>
				} />
				<TooltipContent side="bottom">Find in file</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger render={
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Full width" aria-pressed={wide} className={wide ? 'bg-muted text-foreground' : 'text-muted-foreground'} onMouseDown={(event) => event.preventDefault()} onClick={() => onWideChange(!wide)}>
						<MoveHorizontal />
					</Button>
				} />
				<TooltipContent side="bottom">Full width</TooltipContent>
			</Tooltip>
		</div>
	);
}
