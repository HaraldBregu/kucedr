'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useStickToBottomContext } from '@/hooks/use-stick-to-bottom';
import { cn } from '@/lib/utils';

export type ScrollButtonProps = {
	className?: string;
	variant?: React.ComponentProps<typeof Button>['variant'];
	size?: React.ComponentProps<typeof Button>['size'];
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

function ScrollButton({
	className,
	variant = 'outline',
	size = 'sm',
	...props
}: ScrollButtonProps) {
	const { isAtBottom, scrollToBottom } = useStickToBottomContext();

	return (
		<Button
			variant={variant}
			size={size}
			className={cn(
				'h-8 w-8 rounded-full transition-all duration-150 ease-out',
				isAtBottom
					? 'pointer-events-none translate-y-2 opacity-0'
					: 'translate-y-0 opacity-100',
				className
			)}
			onClick={() => scrollToBottom()}
			{...props}
		>
			<ChevronDown className="size-4" />
		</Button>
	);
}

export { ScrollButton };
