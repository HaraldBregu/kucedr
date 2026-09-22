import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-accent data-[pressed]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: 'bg-transparent',
				outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
			},
			size: {
				default: 'h-10 min-w-10 px-3',
				sm: 'h-9 min-w-9 px-2.5',
				lg: 'h-11 min-w-11 px-5',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

function Toggle({
	className,
	variant,
	size,
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>): React.JSX.Element {
	return (
		<TogglePrimitive className={cn(toggleVariants({ variant, size, className }))} {...props} />
	);
}

export { Toggle, toggleVariants };
