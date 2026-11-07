import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

const Preview: React.FC<{ dark?: boolean; className?: string }> = ({ dark, className }) => {
	const bar = dark ? 'bg-neutral-700' : 'bg-neutral-200';
	return (
		<div
			className={cn(
				'absolute inset-0 flex',
				dark ? 'bg-neutral-900' : 'bg-neutral-50',
				className
			)}
		>
			<div
				className={cn(
					'flex w-1/4 flex-col gap-0.5 border-r p-1',
					dark ? 'border-neutral-700' : 'border-neutral-200'
				)}
			>
				<div className={cn('h-1 rounded-full', bar)} />
				<div className={cn('h-1 rounded-full', bar)} />
				<div className={cn('h-1 rounded-full', bar)} />
			</div>
			<div className="flex flex-1 flex-col gap-0.5 p-1">
				<div className={cn('h-1 w-3/4 rounded-full', bar)} />
				<div className={cn('h-1 w-1/2 rounded-full', bar)} />
				<div
					className={cn(
						'mt-auto flex h-2 items-center justify-end rounded-sm border px-0.5',
						dark ? 'border-neutral-700' : 'border-neutral-200'
					)}
				>
					<div className="size-1 rounded-full bg-primary" />
				</div>
			</div>
		</div>
	);
};

export const ThemePicker: React.FC<{ value: Theme; onChange: (theme: Theme) => void }> = ({
	value,
	onChange,
}) => {
	const { t } = useTranslation();
	return (
		<div role="radiogroup" aria-label={t('settings.theme.title')} className="flex gap-2">
			{THEMES.map((theme) => (
				<button
					key={theme}
					type="button"
					role="radio"
					aria-checked={value === theme}
					onClick={() => onChange(theme)}
					className="flex flex-col items-center gap-1 outline-none"
				>
					<div
						className={cn(
							'relative h-10 w-16 overflow-hidden rounded-md border ring-offset-background',
							value === theme ? 'ring-2 ring-primary ring-offset-1' : 'hover:border-ring'
						)}
					>
						<Preview dark={theme === 'dark'} />
						{theme === 'system' && <Preview dark className="[clip-path:inset(0_0_0_50%)]" />}
					</div>
					<span
						className={cn(
							'text-[11px]',
							value === theme ? 'text-foreground' : 'text-muted-foreground'
						)}
					>
						{t(`settings.theme.${theme}`)}
					</span>
				</button>
			))}
		</div>
	);
};
