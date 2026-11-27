import { LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLock } from '@/hooks/lock';

export function LockButton(): React.JSX.Element | null {
	const { t } = useTranslation();
	const { state } = useLock();
	if (!state?.enabled || state.locked) return null;
	const label = t('settings.privacy.lock.lockNow');

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8 rounded-full dark:hover:bg-accent"
						aria-label={label}
						onClick={() => void window.app.lockNow()}
					>
						<LockKeyhole className="size-4" strokeWidth={1.8} />
					</Button>
				}
			/>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
