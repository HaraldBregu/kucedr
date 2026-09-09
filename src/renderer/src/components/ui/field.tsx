import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
	readonly children: ReactNode;
	readonly orientation?: 'horizontal' | 'vertical';
	readonly className?: string;
}

function Field({ children, orientation = 'vertical', className }: FieldProps): React.JSX.Element {
	return (
		<div
			data-slot="field"
			data-orientation={orientation}
			className={cn(
				orientation === 'horizontal' ? 'flex flex-row items-center gap-2' : 'flex flex-col gap-1.5',
				className
			)}
		>
			{children}
		</div>
	);
}

export { Field };
