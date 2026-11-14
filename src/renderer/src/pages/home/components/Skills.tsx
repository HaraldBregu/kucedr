import { Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ActiveSkills({
	skillIds,
	disabled,
	onRemove,
}: {
	readonly skillIds: readonly string[];
	readonly disabled: boolean;
	readonly onRemove: (skillId: string) => void;
}) {
	if (skillIds.length === 0) return null;
	return (
		<div role="group" aria-label="Active skills" className="mb-2 flex flex-wrap gap-1.5">
			{skillIds.map((skillId) => (
				<Badge key={skillId} variant="secondary" className="pr-1">
					<Sparkles data-icon="inline-start" />
					{skillId}
					<button
						type="button"
						disabled={disabled}
						aria-label={`Stop using the ${skillId} skill`}
						className="rounded-full p-0.5 hover:bg-muted disabled:opacity-50"
						onClick={() => onRemove(skillId)}
					>
						<X className="size-3" />
					</button>
				</Badge>
			))}
		</div>
	);
}
