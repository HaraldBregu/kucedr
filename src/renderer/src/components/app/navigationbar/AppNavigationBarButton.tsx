import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AppNavigationBarButton as AppNavigationBarButtonDescriptor } from '@shared/window_types';
import { Button } from '@/components/ui/button';
import { AppNavigationBarIcon } from './AppNavigationBarIcon';

interface AppNavigationBarButtonProps {
	readonly button: AppNavigationBarButtonDescriptor;
}

export function AppNavigationBarButton({
	button,
}: AppNavigationBarButtonProps): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger render={
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground data-[pressed=true]:bg-muted data-[pressed=true]:text-foreground"
					data-pressed={button.pressed}
					aria-label={button.label}
					aria-expanded={button.expanded}
					aria-pressed={button.pressed}
					disabled={button.disabled}
					onClick={() => window.win.clickNavigationBarButton(button.id)}
				>
					<AppNavigationBarIcon icon={button.icon} />
				</Button>
			} />
			<TooltipContent side="bottom">{button.label}</TooltipContent>
		</Tooltip>
	);
}
