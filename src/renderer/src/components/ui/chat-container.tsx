'use client';

import * as React from 'react';
import { StickToBottom } from 'use-stick-to-bottom';

import { cn } from '@/lib/utils';

export type ChatContainerRootProps = {
	children: React.ReactNode;
	className?: string;
	resize?: React.ComponentProps<typeof StickToBottom>['resize'];
} & React.HTMLAttributes<HTMLDivElement>;

function ChatContainerRoot({ children, className, resize = 'smooth', ...props }: ChatContainerRootProps) {
	return (
		<StickToBottom
			className={cn('relative flex-1 overflow-y-auto', className)}
			resize={resize}
			initial="instant"
			role="log"
			{...props}
		>
			{children}
		</StickToBottom>
	);
}

export type ChatContainerContentProps = {
	children: React.ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

function ChatContainerContent({ children, className, ...props }: ChatContainerContentProps) {
	return (
		<StickToBottom.Content className={cn('flex w-full flex-col', className)} {...props}>
			{children}
		</StickToBottom.Content>
	);
}

export type ChatContainerScrollAnchorProps = {
	className?: string;
	ref?: React.RefObject<HTMLDivElement>;
};

function ChatContainerScrollAnchor({ className, ref }: ChatContainerScrollAnchorProps) {
	return (
		<div
			ref={ref}
			className={cn('h-px w-full shrink-0 scroll-mt-4', className)}
			aria-hidden="true"
		/>
	);
}

export { ChatContainerRoot, ChatContainerContent, ChatContainerScrollAnchor };
