import React, { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SettingsPageShellProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export function SettingsPageShell({
	children,
	className,
}: SettingsPageShellProps): React.JSX.Element {
	return (
		<div
			className={cn(
				'mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-8 sm:px-10 sm:py-10',
				className
			)}
		>
			{children}
		</div>
	);
}

interface SettingsPageHeaderProps {
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly icon?: LucideIcon;
	readonly iconNode?: ReactNode;
	readonly action?: ReactNode;
}

export function SettingsPageHeader({
	title,
	description,
	icon: Icon,
	iconNode,
	action,
}: SettingsPageHeaderProps): React.JSX.Element {
	const renderedIcon = iconNode ?? (Icon ? <Icon className="size-3" strokeWidth={1.8} /> : null);

	return (
		<header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex min-w-0 items-start gap-2">
				{renderedIcon && (
					<div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
						{renderedIcon}
					</div>
				)}
				<div className="min-w-0">
					<h1 className="text-lg font-semibold leading-6 tracking-normal text-foreground">
						{title}
					</h1>
					{description && (
						<p className="mt-0.5 max-w-2xl text-[10px] leading-4 text-muted-foreground">
							{description}
						</p>
					)}
				</div>
			</div>
			{action && (
				<div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
					{action}
				</div>
			)}
		</header>
	);
}

interface SettingsSectionProps {
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly action?: ReactNode;
	readonly children: ReactNode;
	readonly className?: string;
	readonly hideTitle?: boolean;
}

export function SettingsSection({
	title,
	description,
	action,
	children,
	className,
	hideTitle,
}: SettingsSectionProps): React.JSX.Element {
	return (
		<section className={cn('flex flex-col gap-2', className)}>
			<div className="flex flex-col gap-1 px-0.5 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					{!hideTitle && (
						<h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							{title}
						</h2>
					)}
					{description && (
						<p className="mt-0.5 max-w-2xl text-[10px] leading-4 text-muted-foreground">
							{description}
						</p>
					)}
				</div>
				{action && (
					<div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:shrink-0 sm:justify-end">
						{action}
					</div>
				)}
			</div>
			{children}
		</section>
	);
}

interface SettingsPanelProps {
	readonly children: ReactNode;
	readonly className?: string;
}

export function SettingsPanel({ children, className }: SettingsPanelProps): React.JSX.Element {
	return (
		<Card size="sm" className={cn('p-0!', className)}>
			<CardContent className="p-0!">{children}</CardContent>
		</Card>
	);
}

interface SettingsRowProps {
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly icon?: LucideIcon;
	readonly media?: ReactNode;
	readonly actions?: ReactNode;
	readonly children?: ReactNode;
	readonly className?: string;
	readonly contentClassName?: string;
	readonly actionClassName?: string;
}

export function SettingsRow({
	title,
	description,
	icon: Icon,
	media,
	actions,
	children,
	className,
	contentClassName,
	actionClassName,
}: SettingsRowProps): React.JSX.Element {
	const rowActions = actions ?? children;

	return (
		<div
			className={cn(
				'grid min-h-11 items-center gap-2 border-b border-border/60 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-4',
				className
			)}
		>
			<div className={cn('flex min-w-0 items-center gap-4', contentClassName)}>
				{media ??
					(Icon && (
						<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
							<Icon className="size-3" strokeWidth={1.8} />
						</span>
					))}
				<div className="min-w-0 flex-1">
					<div className="text-[13px] font-medium leading-4 tracking-normal text-foreground">
						{title}
					</div>
					{description && (
						<p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
					)}
				</div>
			</div>
			{rowActions && (
				<div
					className={cn(
						'flex w-full min-w-0 flex-wrap items-center justify-start gap-1.5 sm:ml-auto sm:w-auto sm:justify-end',
						actionClassName
					)}
				>
					{rowActions}
				</div>
			)}
		</div>
	);
}

interface SettingsValueProps {
	readonly children: ReactNode;
	readonly mono?: boolean;
	readonly className?: string;
}

export function SettingsValue({
	children,
	mono,
	className,
}: SettingsValueProps): React.JSX.Element {
	return (
		<span
			className={cn(
				'inline-flex h-6 max-w-full items-center rounded-md border border-border/70 bg-muted/40 px-2 text-[11px] text-foreground',
				mono && 'font-mono',
				className
			)}
		>
			<span className="flex min-w-0 items-center truncate">{children}</span>
		</span>
	);
}

interface SettingsNoticeProps {
	readonly children: ReactNode;
	readonly icon?: LucideIcon;
	readonly variant?: 'default' | 'destructive';
	readonly className?: string;
}

export function SettingsNotice({
	children,
	icon: Icon,
	variant = 'default',
	className,
}: SettingsNoticeProps): React.JSX.Element {
	return (
		<div
			role={variant === 'destructive' ? 'alert' : undefined}
			className={cn(
				'flex items-start gap-2 rounded-lg border px-4 py-3 text-xs shadow-none',
				variant === 'destructive'
					? 'border-destructive/30 bg-destructive/10 text-destructive'
					: 'border-border/70 bg-muted/30 text-muted-foreground',
				className
			)}
		>
			{Icon && <Icon className="mt-0.5 size-3 shrink-0" />}
			<span className="min-w-0">{children}</span>
		</div>
	);
}

interface SettingsEmptyStateProps {
	readonly icon?: LucideIcon;
	readonly title: ReactNode;
	readonly description?: ReactNode;
	readonly children?: ReactNode;
	readonly className?: string;
}

export function SettingsEmptyState({
	icon: Icon,
	title,
	description,
	children,
	className,
}: SettingsEmptyStateProps): React.JSX.Element {
	return (
		<Empty className={cn('min-h-20 gap-2 border-0 p-4', className)}>
			<EmptyHeader className="gap-1">
				{Icon && (
					<EmptyMedia variant="icon" className="mb-1 size-7 rounded-md">
						<Icon className="size-3.5" />
					</EmptyMedia>
				)}
				<EmptyTitle className="text-xs">{title}</EmptyTitle>
				{description && (
					<EmptyDescription className="text-[11px] leading-4">{description}</EmptyDescription>
				)}
			</EmptyHeader>
			{children}
		</Empty>
	);
}

interface SettingsLoadingRowsProps {
	readonly rows?: number;
	readonly className?: string;
}

export function SettingsLoadingRows({
	rows = 3,
	className,
}: SettingsLoadingRowsProps): React.JSX.Element {
	return (
		<div className={cn('grid gap-2 p-4', className)}>
			{Array.from({ length: rows }).map((_, index) => (
				<div key={index} className="flex min-h-9 items-center gap-2">
					<Skeleton className="size-6 rounded-md" />
					<div className="grid min-w-0 flex-1 gap-1">
						<Skeleton className="h-3 w-1/3" />
						<Skeleton className="h-2.5 w-2/3" />
					</div>
				</div>
			))}
		</div>
	);
}

export function SettingsPageSkeleton(): React.JSX.Element {
	return (
		<SettingsPageShell>
			<header>
				<Skeleton className="h-5 w-40 max-w-full" />
				<Skeleton className="mt-2 h-3 w-72 max-w-full" />
			</header>

			{[0, 1, 2].map((card) => (
				<Card key={card} size="sm" className="gap-0! p-4!">
					<Skeleton className="h-4 w-1/3 max-w-full" />
					<Skeleton className="mt-3 h-14 w-full" />
				</Card>
			))}
		</SettingsPageShell>
	);
}

interface SettingsFieldProps {
	readonly id: string;
	readonly label: ReactNode;
	readonly description?: ReactNode;
	readonly children: ReactNode;
	readonly className?: string;
}

export function SettingsField({
	id,
	label,
	description,
	children,
	className,
}: SettingsFieldProps): React.JSX.Element {
	return (
		<div className={cn('grid gap-1.5', className)}>
			<div className="grid gap-1">
				<Label htmlFor={id} className="text-[11px] leading-4">
					{label}
				</Label>
				{description && (
					<p id={`${id}-description`} className="text-[11px] leading-4 text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			{children}
		</div>
	);
}
