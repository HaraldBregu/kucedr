'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type LoaderVariant =
	| 'circular'
	| 'classic'
	| 'pulse'
	| 'pulse-dot'
	| 'dots'
	| 'typing'
	| 'wave'
	| 'bars'
	| 'terminal'
	| 'text-blink'
	| 'text-shimmer'
	| 'loading-dots';

type LoaderSize = 'sm' | 'md' | 'lg';

export type LoaderProps = {
	variant?: LoaderVariant;
	size?: LoaderSize;
	text?: string;
	className?: string;
};

const sizeMap: Record<LoaderSize, string> = {
	sm: 'size-3',
	md: 'size-4',
	lg: 'size-5',
};

const textSizeMap: Record<LoaderSize, string> = {
	sm: 'text-xs',
	md: 'text-sm',
	lg: 'text-base',
};

function CircularLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	return (
		<div
			className={cn(
				'animate-spin rounded-full border-2 border-current border-t-transparent',
				sizeMap[size],
				className
			)}
		/>
	);
}

function ClassicLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	const bars = Array.from({ length: 12 });
	return (
		<div className={cn('relative', sizeMap[size], className)}>
			{bars.map((_, i) => (
				<span
					key={i}
					className="absolute left-1/2 top-0 h-1/4 w-[8%] -translate-x-1/2 rounded-full bg-current"
					style={{
						transform: `translate(-50%, 0) rotate(${i * 30}deg) translateY(0)`,
						transformOrigin: '50% 200%',
						opacity: 1 - (i / bars.length) * 0.9,
						animation: 'spin 1s linear infinite',
						animationDelay: `${-i * (1 / bars.length)}s`,
					}}
				/>
			))}
		</div>
	);
}

function PulseLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	return (
		<div
			className={cn(
				'animate-pulse rounded-full bg-current opacity-75',
				sizeMap[size],
				className
			)}
		/>
	);
}

function PulseDotLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	return (
		<div className={cn('relative inline-flex', sizeMap[size], className)}>
			<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
			<span className="relative inline-flex h-full w-full rounded-full bg-current" />
		</div>
	);
}

function DotsLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	const dot = cn('rounded-full bg-current animate-bounce', sizeMap[size]);
	return (
		<div className={cn('inline-flex items-center gap-1', className)}>
			<span className={dot} style={{ animationDelay: '0ms' }} />
			<span className={dot} style={{ animationDelay: '150ms' }} />
			<span className={dot} style={{ animationDelay: '300ms' }} />
		</div>
	);
}

function TypingLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	const dotSize = size === 'sm' ? 'size-1' : size === 'lg' ? 'size-2.5' : 'size-1.5';
	const dot = cn('rounded-full bg-current animate-bounce', dotSize);
	return (
		<div className={cn('inline-flex items-center gap-1', className)}>
			<span className={dot} style={{ animationDelay: '0ms' }} />
			<span className={dot} style={{ animationDelay: '200ms' }} />
			<span className={dot} style={{ animationDelay: '400ms' }} />
		</div>
	);
}

function WaveLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	const barH = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4';
	return (
		<div className={cn('inline-flex items-end gap-0.5', className)}>
			{[0, 1, 2, 3, 4].map((i) => (
				<span
					key={i}
					className={cn('w-0.5 bg-current animate-pulse', barH)}
					style={{ animationDelay: `${i * 100}ms` }}
				/>
			))}
		</div>
	);
}

function BarsLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	return <WaveLoader size={size} className={className} />;
}

function TerminalLoader({ size = 'md', className }: { size?: LoaderSize; className?: string }) {
	return (
		<span className={cn('inline-block animate-pulse font-mono', textSizeMap[size], className)}>
			▋
		</span>
	);
}

function TextBlinkLoader({
	text = 'Thinking',
	size = 'md',
	className,
}: {
	text?: string;
	size?: LoaderSize;
	className?: string;
}) {
	return (
		<span className={cn('inline-block animate-pulse', textSizeMap[size], className)}>
			{text}
		</span>
	);
}

function TextShimmerLoader({
	text = 'Thinking',
	size = 'md',
	className,
}: {
	text?: string;
	size?: LoaderSize;
	className?: string;
}) {
	return (
		<span
			className={cn(
				'inline-block bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent',
				textSizeMap[size],
				className
			)}
			style={{ animation: 'shimmer 2s linear infinite' }}
		>
			{text}
		</span>
	);
}

function TextDotsLoader({
	text = 'Thinking',
	size = 'md',
	className,
}: {
	text?: string;
	size?: LoaderSize;
	className?: string;
}) {
	const [dots, setDots] = React.useState('');
	React.useEffect(() => {
		const id = setInterval(() => {
			setDots((d) => (d.length >= 3 ? '' : d + '.'));
		}, 400);
		return () => clearInterval(id);
	}, []);
	return (
		<span className={cn('inline-block', textSizeMap[size], className)}>
			{text}
			{dots}
		</span>
	);
}

function Loader({ variant = 'circular', size = 'md', text, className }: LoaderProps) {
	switch (variant) {
		case 'circular':
			return <CircularLoader size={size} className={className} />;
		case 'classic':
			return <ClassicLoader size={size} className={className} />;
		case 'pulse':
			return <PulseLoader size={size} className={className} />;
		case 'pulse-dot':
			return <PulseDotLoader size={size} className={className} />;
		case 'dots':
			return <DotsLoader size={size} className={className} />;
		case 'typing':
			return <TypingLoader size={size} className={className} />;
		case 'wave':
			return <WaveLoader size={size} className={className} />;
		case 'bars':
			return <BarsLoader size={size} className={className} />;
		case 'terminal':
			return <TerminalLoader size={size} className={className} />;
		case 'text-blink':
			return <TextBlinkLoader text={text} size={size} className={className} />;
		case 'text-shimmer':
			return <TextShimmerLoader text={text} size={size} className={className} />;
		case 'loading-dots':
			return <TextDotsLoader text={text} size={size} className={className} />;
		default:
			return <CircularLoader size={size} className={className} />;
	}
}

export {
	Loader,
	CircularLoader,
	ClassicLoader,
	PulseLoader,
	PulseDotLoader,
	DotsLoader,
	TypingLoader,
	WaveLoader,
	BarsLoader,
	TerminalLoader,
	TextBlinkLoader,
	TextShimmerLoader,
	TextDotsLoader,
};
