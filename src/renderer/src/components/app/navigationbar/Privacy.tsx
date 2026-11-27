import { LoaderCircle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePrivacy } from '@/hooks/privacy';
import { cn } from '@/lib/utils';

const icons = {
	off: Shield,
	connecting: LoaderCircle,
	protected: ShieldCheck,
	blocked: ShieldAlert,
};

export function Privacy(): React.JSX.Element | null {
	const { t } = useTranslation();
	const { state } = usePrivacy();
	const Icon = state ? icons[state.status] : Shield;
	const label = state
		? t('settings.privacy.toolbarStatus', { status: t(`settings.privacy.status.${state.status}`) })
		: t('settings.privacy.title');
	const pending = state?.restartRequired ? t('settings.privacy.restartRequired') : undefined;
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Link
						to="/settings/privacy"
						aria-label={pending ? `${label} · ${pending}` : label}
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
				{pending && <span className="block">{pending}</span>}
			</TooltipContent>
		</Tooltip>
	);
}
