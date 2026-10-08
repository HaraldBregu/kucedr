import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ListEditor({
	id,
	value,
	items,
	placeholder,
	addLabel,
	removeLabel,
	emptyLabel,
	onDraftChange,
	onAdd,
	onRemove,
	disabled,
}: {
	readonly id: string;
	readonly value: string;
	readonly items: readonly string[];
	readonly placeholder: string;
	readonly addLabel: string;
	readonly removeLabel: (item: string) => string;
	readonly emptyLabel: string;
	readonly onDraftChange: (value: string) => void;
	readonly onAdd: () => void;
	readonly onRemove: (value: string) => void;
	readonly disabled?: boolean;
}): React.JSX.Element {
	const canAdd = !disabled && value.trim().length > 0;

	return (
		<div className="flex w-full min-w-0 flex-col gap-2">
			<div className="flex h-8 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background/70 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
				<input
					id={id}
					value={value}
					disabled={disabled}
					onChange={(event) => onDraftChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' && canAdd) {
							event.preventDefault();
							onAdd();
						}
					}}
					placeholder={placeholder}
					className="min-w-0 flex-1 border-0 bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
					aria-label={placeholder}
				/>
				<div className="flex shrink-0 items-center border-l border-input px-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="size-6"
						disabled={!canAdd}
						onClick={onAdd}
						aria-label={addLabel}
						title={addLabel}
					>
						<Plus className="size-3" />
					</Button>
				</div>
			</div>

			<div className="rounded-lg border border-border/70 bg-muted/20 p-2">
				{items.length > 0 ? (
					<ul className="flex flex-col gap-1">
						{items.map((item) => (
							<li
								key={item}
								className="flex min-h-8 items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1"
							>
								<span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
									{item}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									onClick={() => onRemove(item)}
									disabled={disabled}
									className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
									aria-label={removeLabel(item)}
								>
									<X className="size-3" />
								</Button>
							</li>
						))}
					</ul>
				) : (
					<p className="px-1 py-3 text-center text-[11px] leading-4 text-muted-foreground">
						{emptyLabel}
					</p>
				)}
			</div>
		</div>
	);
}
