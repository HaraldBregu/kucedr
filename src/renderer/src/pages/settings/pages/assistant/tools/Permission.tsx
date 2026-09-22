import { Ban, CircleCheck, Hand } from 'lucide-react';
import type { AgentToolConfiguration } from '../../../../../../../shared/agent_tools';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ToolPermission = AgentToolConfiguration['permission'];

export function ToolPermissionControl({
	name,
	value,
	disabled,
	onChange,
}: {
	readonly name: string;
	readonly value: ToolPermission;
	readonly disabled: boolean;
	readonly onChange: (value: ToolPermission) => void;
}): React.JSX.Element {
	const options = [
		{ value: 'allow' as const, label: 'Always Allow', icon: CircleCheck },
		{ value: 'ask' as const, label: 'Ask', icon: Hand },
		{ value: 'deny' as const, label: 'Deny', icon: Ban },
	];

	return (
		<TooltipProvider delay={400}>
			<ToggleGroup
				type="single"
				value={value}
				disabled={disabled}
				aria-label={`Permission: ${name}`}
				className="gap-0.5 rounded-lg bg-muted p-0.5"
				onValueChange={(next) => {
					if (next) onChange(next as ToolPermission);
				}}
			>
				{options.map(({ value: optionValue, label, icon: Icon }) => (
					<Tooltip key={optionValue}>
						<TooltipTrigger
							render={
								<ToggleGroupItem
									value={optionValue}
									aria-label={`${name}: ${label}`}
									className="size-7 min-w-0 rounded-md p-0 text-muted-foreground hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
								>
									<Icon aria-hidden="true" />
								</ToggleGroupItem>
							}
						/>
						<TooltipContent>{label}</TooltipContent>
					</Tooltip>
				))}
			</ToggleGroup>
		</TooltipProvider>
	);
}
