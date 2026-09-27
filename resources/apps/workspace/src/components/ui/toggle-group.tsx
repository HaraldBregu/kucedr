import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '../../lib/utils';

const ToggleGroup = React.forwardRef<
	React.ElementRef<typeof ToggleGroupPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
	<ToggleGroupPrimitive.Root
		ref={ref}
		data-slot="toggle-group"
		className={cn('inline-flex items-center rounded-md bg-muted p-0.5', className)}
		{...props}
	/>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

export { ToggleGroup };
