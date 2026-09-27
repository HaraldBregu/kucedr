import { ChevronDown, ChevronUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FindProps {
	autoFocus?: boolean;
	className?: string;
	matchCount: number;
	onClose: () => void;
	onNext: () => void;
	onPrevious: () => void;
	onQueryChange: (query: string) => void;
	query: string;
}

export function Find({
	autoFocus = false,
	className,
	matchCount,
	onClose,
	onNext,
	onPrevious,
	onQueryChange,
	query,
}: FindProps) {
	const disabled = !query || matchCount === 0;

	return (
		<div
			role="search"
			className={cn('flex min-w-0 items-center gap-1', className)}
		>
			<Input
				autoFocus={autoFocus}
				value={query}
				onChange={(event) => onQueryChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Escape') onClose();
					if (event.key === 'Enter') {
						event.preventDefault();
						if (event.shiftKey) onPrevious();
						else onNext();
					}
				}}
				placeholder="Find in file"
				aria-label="Find in file"
				className="h-7 w-32 shrink-0 rounded-none border-0 bg-muted/70 px-2 text-xs shadow-none focus-visible:ring-0 sm:w-40"
			/>
			<span className="shrink-0 px-1 text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
				{query ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : 'Find'}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-7"
				aria-label="Previous match"
				disabled={disabled}
				onClick={onPrevious}
			>
				<ChevronUp />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-7"
				aria-label="Next match"
				disabled={disabled}
				onClick={onNext}
			>
				<ChevronDown />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-7"
				aria-label="Close find"
				onClick={onClose}
			>
				<X />
			</Button>
		</div>
	);
}
