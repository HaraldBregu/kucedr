import { createContext, useContext } from 'react';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Toggle, toggleVariants } from '@/components/ui/toggle';

const ToggleGroupContext = createContext<VariantProps<typeof toggleVariants>>({
	size: 'default',
	variant: 'default',
});

type ToggleGroupProps = Omit<
	ToggleGroupPrimitive.Props<string>,
	'value' | 'defaultValue' | 'onValueChange' | 'multiple'
> &
	VariantProps<typeof toggleVariants> & {
		readonly type: 'single';
		readonly value?: string;
		readonly defaultValue?: string;
		readonly onValueChange?: (value: string) => void;
	};

function ToggleGroup({
	className,
	variant,
	size,
	children,
	value,
	defaultValue,
	onValueChange,
	...props
}: ToggleGroupProps): React.JSX.Element {
	return (
		<ToggleGroupPrimitive
			value={value ? [value] : []}
			defaultValue={defaultValue ? [defaultValue] : []}
			onValueChange={(values) => onValueChange?.(values[0] ?? '')}
			className={cn('flex items-center justify-center gap-1', className)}
			{...props}
		>
			<ToggleGroupContext.Provider value={{ variant, size }}>
				{children}
			</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive>
	);
}

function ToggleGroupItem({
	className,
	variant,
	size,
	...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>): React.JSX.Element {
	const context = useContext(ToggleGroupContext);
	return (
		<Toggle
			className={cn(className)}
			variant={context.variant ?? variant}
			size={context.size ?? size}
			{...props}
		/>
	);
}

export { ToggleGroup, ToggleGroupItem };
