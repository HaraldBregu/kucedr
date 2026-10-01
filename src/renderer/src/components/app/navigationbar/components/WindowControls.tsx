import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavigationBarRightContainer } from '../NavigationBarRightContainer';

const btnBase =
	'flex items-center justify-center h-full w-[46px] text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 active:bg-muted transition-colors duration-100';

interface WindowControlsProps {
	readonly isMaximized: boolean;
}

export function WindowControls({ isMaximized }: WindowControlsProps) {
	const { t } = useTranslation();
	const maximizeLabel = t(isMaximized ? 'navigationBar.restore' : 'navigationBar.maximize');

	return (
		<NavigationBarRightContainer>
			<Tooltip>
				<TooltipTrigger render={
					<button
						type="button"
						onClick={() => window.win?.minimize()}
						className={btnBase}
						aria-label={t('navigationBar.minimize')}
					>
						<Minus className="h-[13px] w-[13px]" strokeWidth={1.5} />
					</button>
				} />
				<TooltipContent side="bottom">{t('navigationBar.minimize')}</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger render={
					<button
						type="button"
						onClick={() => window.win?.maximize()}
						className={btnBase}
						aria-label={maximizeLabel}
					>
						{isMaximized ? (
							<Copy className="h-[11px] w-[11px]" strokeWidth={1.5} />
						) : (
							<Square className="h-[11px] w-[11px]" strokeWidth={1.5} />
						)}
					</button>
				} />
				<TooltipContent side="bottom">{maximizeLabel}</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger render={
					<button
						type="button"
						onClick={() => window.win?.close()}
						className="flex items-center justify-center h-full w-[46px] text-foreground hover:bg-[#e81123] hover:text-white active:bg-[#c42b1c] active:text-white transition-colors duration-100"
						aria-label={t('navigationBar.close')}
					>
						<X className="h-[13px] w-[13px]" strokeWidth={1.5} />
					</button>
				} />
				<TooltipContent side="bottom">{t('navigationBar.close')}</TooltipContent>
			</Tooltip>
		</NavigationBarRightContainer>
	);
}
