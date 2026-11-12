import type { ReactElement } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { PromptInputAction } from '@/components/ui/prompt-input';

export function PromptSubmit({
	isLoading,
	onAction,
	disabled,
}: {
	readonly isLoading: boolean;
	readonly onAction: () => void;
	readonly disabled?: boolean;
}): ReactElement {
	const label = isLoading ? 'Stop generation' : 'Send message';
	const iconKey = isLoading ? 'stop' : 'send';
	const icon = isLoading ? (
		<Square className="size-5 fill-current" />
	) : (
		<ArrowUp className="size-5" />
	);

	return (
		<PromptInputAction tooltip={label}>
			<Button
				type="button"
				variant="default"
				size="icon"
				className="h-9 w-12 overflow-hidden rounded-none bg-foreground text-background hover:bg-foreground/90"
				aria-label={label}
				disabled={disabled}
				onClick={onAction}
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={iconKey}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
						className="flex items-center justify-center"
					>
						{icon}
					</motion.span>
				</AnimatePresence>
			</Button>
		</PromptInputAction>
	);
}
