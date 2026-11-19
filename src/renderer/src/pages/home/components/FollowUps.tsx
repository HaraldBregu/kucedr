import { Clock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AgentFollowUp } from '@shared/agent_types';
import { Badge } from '@/components/ui/badge';

export function FollowUps({
	followUps,
	onRemove,
}: {
	readonly followUps: readonly AgentFollowUp[];
	readonly onRemove: (id: string) => void;
}) {
	const { t } = useTranslation();
	if (followUps.length === 0) return null;
	return (
		<div role="group" aria-label={t('chat.followUp.queued')} className="mb-2 flex flex-wrap gap-1.5">
			{followUps.map((followUp) => (
				<Badge key={followUp.id} variant="secondary" className="max-w-full pr-1">
					<Clock data-icon="inline-start" />
					<span className="truncate">{followUp.text}</span>
					<button
						type="button"
						aria-label={t('chat.followUp.remove')}
						className="rounded-full p-0.5 hover:bg-muted"
						onClick={() => onRemove(followUp.id)}
					>
						<X className="size-3" />
					</button>
				</Badge>
			))}
		</div>
	);
}
