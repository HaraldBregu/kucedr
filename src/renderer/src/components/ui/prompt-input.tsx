'use client';

import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { BarWaveAnimation } from './bar-wave-animation';
import { TypingLoader } from './loader';
import { Persona, type PersonaState } from '@/components/persona';
import { cn } from '@/lib/utils';
import { Check, Mic, MicOff, X } from 'lucide-react';
import { resize } from 'motion';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';

type PromptInputContextType = {
	isLoading: boolean;
	value: string;
	setValue: (value: string) => void;
	maxHeight: number | string;
	maxLength?: number;
	onSubmit?: () => void;
	disabled?: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	isExpanded: boolean;
	adaptiveLayout: boolean;
	triggerFileUpload: () => void;
};

const PromptInputContext = createContext<PromptInputContextType>({
	isLoading: false,
	value: '',
	setValue: () => {},
	maxHeight: 240,
	maxLength: undefined,
	onSubmit: undefined,
	disabled: false,
	textareaRef: React.createRef<HTMLTextAreaElement>(),
	isExpanded: false,
	adaptiveLayout: false,
	triggerFileUpload: () => {},
});

function usePromptInput() {
	return useContext(PromptInputContext);
}

export type PromptInputProps = {
	isLoading?: boolean;
	value?: string;
	onValueChange?: (value: string) => void;
	maxHeight?: number | string;
	maxLength?: number;
	expandedThreshold?: number;
	expanded?: boolean;
	onSubmit?: () => void;
	children: React.ReactNode;
	className?: string;
	wrapperClassName?: string;
	contentClassName?: string;
	footerClassName?: string;
	header?: React.ReactNode;
	leadingAction?: React.ReactNode;
	actions?: React.ReactNode;
	disabled?: boolean;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	voiceMode?: PromptInputVoiceMode | null;
	voiceElapsedMs?: number;
	voiceMuted?: boolean;
	voiceMediaStream?: MediaStream | null;
	voiceAnalyser?: AnalyserNode | null;
	voiceStatus?: string;
	voicePersonaState?: PersonaState;
	voiceWaveformActive?: boolean;
	onVoiceEnd?: () => void;
	onVoiceCancel?: () => void;
	onVoiceConfirm?: () => void;
	onVoiceMutedChange?: (muted: boolean) => void;
	onFilesChange?: (files: File[]) => void;
	filesAccept?: string;
} & React.ComponentProps<'div'>;

export type PromptInputVoiceMode = 'conversation' | 'dictation';

function usePromptInputTransition() {
	const prefersReducedMotion = useReducedMotion();

	return prefersReducedMotion
		? { duration: 0 }
		: {
				type: 'tween' as const,
				duration: 0.32,
				ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
			};
}

function usePromptInputExpansion({
	value,
	textareaRef,
	threshold,
	enabled,
}: {
	value: string;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	threshold: number;
	enabled: boolean;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!enabled || !textarea || value.length === 0) {
			setIsExpanded(false);
			return;
		}
		// Sticky while non-empty: collapsing widens/narrows the field, so re-measuring
		// after expansion can flip the state back and forth on every keystroke.
		// The scrollWidth check catches long unbroken words that overflow
		// horizontally instead of soft-wrapping.
		setIsExpanded(
			(prev) =>
				prev ||
				value.includes('\n') ||
				textarea.scrollHeight > threshold ||
				textarea.scrollWidth > textarea.clientWidth + 1
		);
	}, [enabled, threshold, textareaRef, value]);

	return isExpanded;
}

function PromptInputMotionSlot({
	children,
	transition,
	ref,
}: {
	children: React.ReactNode;
	transition: ReturnType<typeof usePromptInputTransition>;
	ref?: React.Ref<HTMLDivElement>;
}) {
	return (
		<motion.div
			ref={ref}
			layout="position"
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -4 }}
			transition={transition}
			className="shrink-0"
		>
			{children}
		</motion.div>
	);
}

function PromptInputVoiceWaveform({
	muted,
	mediaStream,
	analyser,
	active,
}: {
	muted: boolean;
	mediaStream?: MediaStream | null;
	analyser?: AnalyserNode | null;
	active?: boolean;
}) {
	return (
		<div
			className={cn(
				'min-w-0 overflow-hidden rounded-full bg-muted/70 shadow-inner',
				muted && 'bg-muted/50'
			)}
			aria-hidden="true"
		>
			<BarWaveAnimation
				active={active ?? !muted}
				height={28}
				mediaStream={mediaStream}
				analyser={analyser}
			/>
		</div>
	);
}

function formatVoiceDuration(elapsedMs: number) {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function PromptInputVoicePanel({
	mode,
	disabled,
	leadingAction,
	elapsedMs,
	muted,
	mediaStream,
	analyser,
	status,
	waveformActive,
	onEnd,
	onCancel,
	onConfirm,
	onMutedChange,
}: {
	mode: PromptInputVoiceMode;
	disabled?: boolean;
	leadingAction?: React.ReactNode;
	elapsedMs?: number;
	muted?: boolean;
	mediaStream?: MediaStream | null;
	analyser?: AnalyserNode | null;
	status?: string;
	waveformActive?: boolean;
	onEnd?: () => void;
	onCancel?: () => void;
	onConfirm?: () => void;
	onMutedChange?: (muted: boolean) => void;
}) {
	const promptInputContext = usePromptInput();
	const transition = usePromptInputTransition();
	const [localMuted, setLocalMuted] = useState(false);
	const isDictation = mode === 'dictation';
	const isMuted = !isDictation && (muted ?? localMuted);

	const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>, action?: () => void) => {
		event.stopPropagation();
		action?.();
	};

	const handleMutedChange = (nextMuted: boolean) => {
		setLocalMuted(nextMuted);
		onMutedChange?.(nextMuted);
	};

	return (
		<motion.div
			key={mode}
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -4 }}
			transition={transition}
			className="flex min-w-0 flex-1 cursor-default items-center gap-2 text-foreground"
		>
			{leadingAction ? (
				<PromptInputContext.Provider value={{ ...promptInputContext, disabled: true }}>
					<div className="shrink-0 opacity-50" aria-disabled="true">
						{leadingAction}
					</div>
				</PromptInputContext.Provider>
			) : null}
			{isDictation ? (
				<div
					className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
					aria-hidden="true"
				>
					<span className="block size-2.5 rounded-full bg-current" />
				</div>
			) : null}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{status ? (
					<span
						role="status"
						aria-live="polite"
						className={cn(
							'truncate text-xs font-medium text-muted-foreground',
							isDictation ? 'w-20 shrink-0' : 'min-w-0 flex-1'
						)}
					>
						{status}
					</span>
				) : null}
				{isDictation ? (
					<div className="min-w-20 flex-1">
						<PromptInputVoiceWaveform
							muted={isMuted}
							mediaStream={mediaStream}
							analyser={analyser}
							active={waveformActive}
						/>
					</div>
				) : null}
				{elapsedMs !== undefined ? (
					<span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
						{formatVoiceDuration(elapsedMs)}
					</span>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-1.5">
				{isDictation ? (
					<>
						<button
							type="button"
							aria-label="Cancel dictation"
							disabled={disabled}
							onClick={(event) => handleButtonClick(event, onCancel)}
							className="flex size-8 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-50"
						>
							<X className="size-4" strokeWidth={2.4} />
						</button>
						<button
							type="button"
							aria-label="Confirm dictation"
							disabled={disabled}
							onClick={(event) => handleButtonClick(event, onConfirm)}
							className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-50"
						>
							<Check className="size-4" strokeWidth={2.8} />
						</button>
					</>
				) : (
					<>
						<button
							type="button"
							aria-label={isMuted ? 'Unmute' : 'Mute'}
							disabled={disabled}
							onClick={(event) => {
								event.stopPropagation();
								handleMutedChange(!isMuted);
							}}
							className={cn(
								'flex size-8 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
								isMuted
									? 'border-destructive/40 bg-destructive/10 text-destructive focus-visible:ring-destructive/40'
									: 'border-border bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/55'
							)}
						>
							{isMuted ? (
								<MicOff className="size-4" strokeWidth={2.4} />
							) : (
								<Mic className="size-4" strokeWidth={2.2} />
							)}
						</button>
						<button
							type="button"
							aria-label="End voice conversation"
							disabled={disabled}
							onClick={(event) => handleButtonClick(event, onEnd)}
							className="flex h-9 w-16 items-center justify-center gap-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-50"
						>
							<TypingLoader size="sm" />
							<span>End</span>
						</button>
					</>
				)}
			</div>
		</motion.div>
	);
}

function PromptInput({
	className,
	wrapperClassName,
	contentClassName,
	footerClassName,
	isLoading = false,
	maxHeight = 240,
	maxLength,
	expandedThreshold = 52,
	expanded,
	value,
	onValueChange,
	onSubmit,
	children,
	header,
	leadingAction,
	actions,
	disabled = false,
	textareaRef: externalTextareaRef,
	voiceMode,
	voiceElapsedMs,
	voiceMuted,
	voiceMediaStream,
	voiceAnalyser,
	voiceStatus,
	voicePersonaState,
	voiceWaveformActive,
	onVoiceEnd,
	onVoiceCancel,
	onVoiceConfirm,
	onVoiceMutedChange,
	onFilesChange,
	filesAccept,
	onClick,
	...props
}: PromptInputProps) {
	const [internalValue, setInternalValue] = useState(value || '');
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = externalTextareaRef ?? internalTextareaRef;
	const triggerFileUpload = () => fileInputRef.current?.click();
	const currentValue = value ?? internalValue;
	const hasAdaptiveLayout = Boolean(leadingAction || actions);
	const contentRef = useRef<HTMLDivElement>(null);
	const [contentHeight, setContentHeight] = useState<number>();
	const transition = usePromptInputTransition();
	const isExpanded = usePromptInputExpansion({
		value: currentValue,
		textareaRef,
		threshold: expandedThreshold,
		enabled: hasAdaptiveLayout,
	});
	const isConversationMode = voiceMode === 'conversation';
	const isDictationMode = voiceMode === 'dictation';
	const isPromptExpanded =
		expanded || isExpanded || isConversationMode || isDictationMode || Boolean(header);

	useLayoutEffect(() => {
		const content = contentRef.current;
		if (!content || !hasAdaptiveLayout) return;
		setContentHeight(content.offsetHeight);
		return resize(content, (_, { height }) => setContentHeight(height));
	}, [hasAdaptiveLayout]);

	const handleChange = (newValue: string) => {
		setInternalValue(newValue);
		onValueChange?.(newValue);
	};

	const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
		onClick?.(e);
		if (!e.defaultPrevented) {
			textareaRef.current?.focus();
		}
	};

	return (
		<TooltipProvider delay={1000}>
			<PromptInputContext.Provider
				value={{
					isLoading,
					value: currentValue,
					setValue: onValueChange ?? handleChange,
					maxHeight,
					maxLength,
					onSubmit,
					disabled,
					textareaRef,
					isExpanded: isPromptExpanded,
					adaptiveLayout: hasAdaptiveLayout,
					triggerFileUpload,
				}}
			>
				{hasAdaptiveLayout ? (
					<div className={cn('mx-auto w-full max-w-[96rem]', wrapperClassName)}>
						<motion.div
							initial={false}
							animate={{
								height: contentHeight === undefined ? 'auto' : contentHeight + 2,
								borderRadius: isConversationMode || !isPromptExpanded ? 28 : 12,
							}}
							transition={transition}
							onClick={isConversationMode ? onClick : handleClick}
							data-expanded={isPromptExpanded}
							data-voice-mode={voiceMode ?? undefined}
							className={cn(
								'relative overflow-hidden cursor-text border border-border/60 bg-card/95 text-foreground shadow-sm shadow-foreground/5 focus-within:ring-1 focus-within:ring-ring/25',
								isConversationMode
									? 'cursor-default rounded-[1.75rem] focus-within:ring-0'
									: isPromptExpanded
										? 'rounded-xl'
										: 'rounded-full',
								disabled && 'cursor-not-allowed opacity-60',
								className
							)}
							{...(props as React.ComponentProps<typeof motion.div>)}
						>
							<div
								ref={contentRef}
								className={cn(
									'relative',
									isConversationMode
										? 'flex h-[min(42vh,18rem)] min-h-56 flex-col gap-2 p-2'
										: isPromptExpanded
											? 'flex max-h-[min(48vh,30rem)] min-h-24 flex-col px-4 py-3'
											: 'flex min-h-12 items-center gap-2 p-1'
								)}
							>
								{isConversationMode ? (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={transition}
										className="relative flex min-h-0 flex-1 items-center justify-center rounded-[1.35rem] bg-neutral-950"
									>
										<button
											type="button"
											aria-label="End voice conversation"
											disabled={disabled}
											onClick={(event) => {
												event.stopPropagation();
												onVoiceEnd?.();
											}}
											className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/70 backdrop-blur-sm transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-50"
										>
											<X className="size-4" strokeWidth={2.4} />
										</button>
										<Persona
											state={voicePersonaState ?? 'idle'}
											level={
												voicePersonaState === 'speaking'
													? 0.72
													: voicePersonaState === 'listening'
														? 0.28
														: 0.16
											}
											size={176}
										/>
									</motion.div>
								) : (
									<>
										{header ? (
											<motion.div
												layout="position"
												transition={transition}
												className="mb-2 shrink-0"
											>
												{header}
											</motion.div>
										) : null}
										<AnimatePresence initial={false} mode="popLayout">
											{!isPromptExpanded && leadingAction && (
												<PromptInputMotionSlot transition={transition}>
													{leadingAction}
												</PromptInputMotionSlot>
											)}
										</AnimatePresence>
										<motion.div
											layout="position"
											transition={transition}
											className={cn(
												isPromptExpanded ? 'min-h-0 flex-1' : 'min-w-0 flex-1',
												contentClassName
											)}
										>
											{children}
										</motion.div>
										<motion.div
											layout="position"
											transition={transition}
											className={cn(
												'relative',
												isPromptExpanded
													? 'mt-3 flex items-center justify-between gap-2'
													: 'flex shrink-0 self-center items-center justify-center gap-1.5',
												isPromptExpanded && footerClassName
											)}
										>
											<AnimatePresence initial={false} mode="popLayout">
												{isPromptExpanded && leadingAction && (
													<PromptInputMotionSlot transition={transition}>
														{leadingAction}
													</PromptInputMotionSlot>
												)}
											</AnimatePresence>
											<AnimatePresence initial={false} mode="popLayout">
												<motion.div
													key={isDictationMode ? 'dictation' : 'actions'}
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													exit={{ opacity: 0, pointerEvents: 'none' }}
													transition={transition}
													className={isDictationMode ? 'min-w-0 flex-1' : 'shrink-0'}
												>
													{isDictationMode ? (
														<PromptInputVoicePanel
															mode="dictation"
															disabled={disabled}
															elapsedMs={voiceElapsedMs}
															muted={voiceMuted}
															mediaStream={voiceMediaStream}
															analyser={voiceAnalyser}
															status={voiceStatus}
															waveformActive={voiceWaveformActive}
															onCancel={onVoiceCancel}
															onConfirm={onVoiceConfirm ?? onSubmit}
															onMutedChange={onVoiceMutedChange}
														/>
													) : (
														actions
													)}
												</motion.div>
											</AnimatePresence>
										</motion.div>
									</>
								)}
							</div>
						</motion.div>
					</div>
				) : (
					<div
						onClick={handleClick}
						className={cn(
							'border-input bg-background cursor-text rounded-2xl border px-3 py-1.5 shadow-xs',
							disabled && 'cursor-not-allowed opacity-60',
							className
						)}
						{...props}
					>
						{children}
					</div>
				)}
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept={filesAccept}
					className="hidden"
					onChange={(e) => {
						const files = Array.from(e.target.files ?? []);
						if (files.length > 0) onFilesChange?.(files);
						e.target.value = '';
					}}
				/>
			</PromptInputContext.Provider>
		</TooltipProvider>
	);
}

export type PromptInputTextareaProps = {
	disableAutosize?: boolean;
} & React.ComponentProps<typeof Textarea>;

function PromptInputTextarea({
	className,
	onKeyDown,
	disableAutosize = false,
	...props
}: PromptInputTextareaProps) {
	const {
		value,
		setValue,
		maxHeight,
		onSubmit,
		disabled,
		textareaRef,
		isExpanded,
		adaptiveLayout,
	} = usePromptInput();

	const adjustHeight = (el: HTMLTextAreaElement | null) => {
		if (!el || disableAutosize) return;

		el.style.height = 'auto';

		if (typeof maxHeight === 'number') {
			el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
		} else {
			el.style.height = `min(${el.scrollHeight}px, ${maxHeight})`;
		}
	};

	const handleRef = (el: HTMLTextAreaElement | null) => {
		textareaRef.current = el;
		adjustHeight(el);
	};

	useLayoutEffect(() => {
		if (!textareaRef.current || disableAutosize) return;

		const el = textareaRef.current;
		el.style.height = 'auto';

		if (typeof maxHeight === 'number') {
			el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
		} else {
			el.style.height = `min(${el.scrollHeight}px, ${maxHeight})`;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, maxHeight, disableAutosize]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		adjustHeight(e.target);
		setValue(e.target.value);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSubmit?.();
		}
		onKeyDown?.(e);
	};

	return (
		<Textarea
			ref={handleRef}
			value={value}
			onChange={handleChange}
			onKeyDown={handleKeyDown}
			className={cn(
				'text-primary min-h-[32px] w-full resize-none border-none bg-transparent! shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
				adaptiveLayout &&
					'appearance-none !border-0 bg-transparent px-0 text-sm leading-6 text-foreground !shadow-none !outline-none placeholder:text-muted-foreground focus:!border-transparent focus:!outline-none focus:!ring-0 focus-visible:!border-transparent focus-visible:!outline-none focus-visible:!ring-0 md:text-sm',
				adaptiveLayout &&
					(isExpanded
						? 'max-h-[34vh] min-h-14 overflow-y-auto py-0'
						: 'h-7 min-h-7 overflow-hidden py-0'),
				className
			)}
			rows={1}
			disabled={disabled}
			{...props}
		/>
	);
}

export type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;

function PromptInputActions({ children, className, ...props }: PromptInputActionsProps) {
	return (
		<div className={cn('flex items-center gap-2', className)} {...props}>
			{children}
		</div>
	);
}

export type PromptInputActionProps = {
	className?: string;
	tooltip: React.ReactNode;
	children: React.ReactElement<{
		disabled?: boolean;
		onClick?: React.MouseEventHandler<HTMLElement>;
	}>;
	side?: 'top' | 'bottom' | 'left' | 'right';
} & React.ComponentProps<typeof Tooltip>;

function PromptInputAction({
	tooltip,
	children,
	className,
	side = 'top',
	...props
}: PromptInputActionProps) {
	const { disabled } = usePromptInput();
	const child = React.cloneElement(children, {
		disabled: disabled || children.props.disabled,
		onClick: (event: React.MouseEvent<HTMLElement>) => {
			event.stopPropagation();
			children.props.onClick?.(event);
		},
	});

	return (
		<Tooltip {...props}>
			<TooltipTrigger render={child} disabled={disabled} />
			<TooltipContent side={side} className={className}>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

export type PromptInputCharCountProps = {
	className?: string;
};

function PromptInputCharCount({ className }: PromptInputCharCountProps) {
	const { value, maxLength } = usePromptInput();
	if (maxLength === undefined) return null;
	const remaining = maxLength - value.length;
	const isWarning = remaining >= 0 && remaining <= Math.ceil(maxLength * 0.15);
	return (
		<span
			role="status"
			aria-label={`${remaining} characters remaining`}
			className={cn(
				'shrink-0 font-mono text-xs tabular-nums transition-colors duration-200',
				remaining < 0
					? 'text-destructive'
					: isWarning
						? 'text-warning'
						: 'text-muted-foreground/50',
				className
			)}
		>
			{remaining}
		</span>
	);
}

export {
	PromptInput,
	PromptInputTextarea,
	PromptInputActions,
	PromptInputAction,
	PromptInputCharCount,
	usePromptInput,
};
