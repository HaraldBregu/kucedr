import { Clock3, LoaderCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePrivacy } from '@/hooks/privacy';
import { cn } from '@/lib/utils';

const icons = {
	off: Clock3,
	connecting: LoaderCircle,
	protected: ShieldCheck,
	blocked: ShieldAlert,
};

export function Privacy(): React.JSX.Element | null {
	const { t } = useTranslation();
	const { state } = usePrivacy();
	if (!state || (state.status === 'off' && !state.restartRequired)) return null;
	const Icon = icons[state.status];
	const status = t(`settings.privacy.status.${state.status}`);
	const label = t('settings.privacy.toolbarStatus', { status });
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						to="/settings/privacy"
						aria-label={label}
						className={cn(
							buttonVariants({ variant: 'ghost', size: 'icon' }),
							'rounded-full dark:hover:bg-accent',
							state.status === 'blocked' && 'text-destructive hover:text-destructive'
						)}
					>
						<Icon
							className={cn('size-4', state.status === 'connecting' && 'motion-safe:animate-spin')}
							strokeWidth={1.8}
							aria-hidden="true"
						/>
					</Link>
				}
			/>
			<TooltipContent side="bottom">
				{label}
				{state.restartRequired && <span className="block">{t('settings.privacy.restartRequired')}</span>}
			</TooltipContent>
		</Tooltip>
	);
}
