import { Copy, Minus, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavigationBarRightContainer } from '../NavigationBarRightContainer';

const btnBase =
	'flex items-center justify-center h-full w-[46px] text-muted-foreground hover:bg-accent/80 hover:text-foreground active:bg-accent transition-colors duration-100';

interface WindowControlsProps {
	readonly isMaximized: boolean;
}

export function WindowControls({ isMaximized }: WindowControlsProps) {
	const { t } = useTranslation();
	const maximizeLabel = t(isMaximized ? 'navigationBar.restore' : 'navigationBar.maximize');

	return (
		<NavigationBarRightContainer>
			<button
				type="button"
				onClick={() => window.win?.minimize()}
				className={btnBase}
				title={t('navigationBar.minimize')}
				aria-label={t('navigationBar.minimize')}
			>
				<Minus className="h-[13px] w-[13px]" strokeWidth={1.5} />
			</button>

			<button
				type="button"
				onClick={() => window.win?.maximize()}
				className={btnBase}
				title={maximizeLabel}
				aria-label={maximizeLabel}
			>
				{isMaximized ? (
					<Copy className="h-[11px] w-[11px]" strokeWidth={1.5} />
				) : (
					<Square className="h-[11px] w-[11px]" strokeWidth={1.5} />
				)}
			</button>

			<button
				type="button"
				onClick={() => window.win?.close()}
				className="flex items-center justify-center h-full w-[46px] text-muted-foreground hover:bg-[#e81123] hover:text-white active:bg-[#c42b1c] active:text-white transition-colors duration-100"
				title={t('navigationBar.close')}
				aria-label={t('navigationBar.close')}
			>
				<X className="h-[13px] w-[13px]" strokeWidth={1.5} />
			</button>
		</NavigationBarRightContainer>
	);
}
