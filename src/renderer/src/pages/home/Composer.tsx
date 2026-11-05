import { memo, useState, type Dispatch, type ReactElement, type ReactNode, type RefObject, type SetStateAction } from 'react';
import type { LibraryFile } from '@shared/library_types';
import { PromptEditor } from '@/components/prompt-editor';
import { PromptSubmit } from '@/components/prompt-submit';
import { PromptInputActions } from '@/components/ui/prompt-input';
import type { ChatMode } from '@/contexts/chat-mode';
import { LIBRARY_DRAG_TYPE } from '../settings/pages/library/drag';
import { libraryAttachments } from './attachments/entries';
import { filesToAttachments } from './attachments/files';
import { droppedLibraryFiles } from './attachments/library';
import type { PromptAttachment } from './attachments/types';
import { AttachmentButton } from './components/AttachmentButton';
import { AttachmentTray } from './components/AttachmentTray';
import { LibraryPicker } from './components/LibraryPicker';
import { RecorderError } from './components/RecorderError';
import { VoiceButton } from './components/VoiceButton';
import type { HomeChatMessage } from './context/state';
import { usePromptVoice } from './hooks/usePromptVoice';
import { Model } from './Model';

const StableModel = memo(Model);

export function Composer({
	value,
	onValueChange,
	onSubmit,
	isLoading,
	mode,
	setMode,
	attachments,
	setAttachments,
	placeholder,
	ariaLabel,
	className,
	inputClassName,
	fade = false,
	header,
	textareaRef,
	messages,
	onContext,
	onPlanCommandChange,
	onGoalCommandChange,
}: {
	readonly value: string;
	readonly onValueChange: (value: string) => void;
	readonly onSubmit: () => void;
	readonly isLoading: boolean;
	readonly mode: ChatMode;
	readonly setMode: (mode: ChatMode) => void;
	readonly attachments: readonly PromptAttachment[];
	readonly setAttachments: Dispatch<SetStateAction<PromptAttachment[]>>;
	readonly placeholder: string;
	readonly ariaLabel: string;
	readonly className?: string;
	readonly inputClassName?: string;
	readonly fade?: boolean;
	readonly header?: ReactNode;
	readonly textareaRef?: RefObject<HTMLTextAreaElement | null>;
	readonly messages?: readonly HomeChatMessage[];
	readonly onContext?: (context: { providerId: string; modelId: string; contextWindow?: number }) => void;
	readonly onPlanCommandChange?: (active: boolean) => void;
	readonly onGoalCommandChange?: (active: boolean) => void;
}): ReactElement {
	const voice = usePromptVoice({ value, onValueChange, isLoading, mode, setMode });
	const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
	const [libraryDropError, setLibraryDropError] = useState(false);
	const attachmentDisabled = voice.voiceMode !== null || voice.busy;
	const addLibraryFiles = (files: LibraryFile[]): void => {
		setAttachments((current) => [...current, ...libraryAttachments(files)]);
	};
	const removeAttachment = (id: string): void => {
		setAttachments((current) =>
			current.filter((attachment) => {
				if (attachment.id !== id) return true;
				if (attachment.url) {
					URL.revokeObjectURL(attachment.url);
				}
				return false;
			})
		);
	};

	return (
		<div
			className={className}
			onDragOverCapture={(event) => {
				if (attachmentDisabled || !event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = 'copy';
			}}
			onDropCapture={(event) => {
				if (!event.dataTransfer.types.includes(LIBRARY_DRAG_TYPE)) return;
				event.preventDefault();
				event.stopPropagation();
				if (attachmentDisabled) return;
				setLibraryDropError(false);
				void droppedLibraryFiles(event.dataTransfer.getData(LIBRARY_DRAG_TYPE)).then(addLibraryFiles).catch(() => setLibraryDropError(true));
			}}
		>
			{libraryDropError && <p role="alert" className="mb-2 text-xs text-destructive">Could not attach Library files. Please try again.</p>}
			<RecorderError
				message={voice.errorMessage}
				actionLabel={voice.errorAction?.label}
				onAction={voice.errorAction?.action}
			/>
			{attachments.length > 0 ? (
				<div className="mb-2">
					<AttachmentTray attachments={attachments} onRemove={removeAttachment} />
				</div>
			) : null}
			<div data-slot="home-composer-container" className="relative flex flex-col bg-background">
				{fade ? (
					<div className="pointer-events-none absolute inset-x-0 bottom-full h-12 bg-gradient-to-b from-transparent to-background" />
				) : null}
				<PromptEditor
					placeholder={placeholder}
					ariaLabel={ariaLabel}
					value={value}
					expanded={false}
					onValueChange={onValueChange}
					onPlanCommandChange={onPlanCommandChange}
					onGoalCommandChange={onGoalCommandChange}
					isLoading={isLoading}
					maxHeight={360}
					onSubmit={onSubmit}
					textareaRef={textareaRef}
					header={header}
					leadingAction={
						voice.voiceMode === 'dictation' ? undefined : (
							<AttachmentButton
								disabled={attachmentDisabled}
								onLibrarySelect={() => setLibraryPickerOpen(true)}
							/>
						)
					}
					voiceMode={voice.voiceMode === 'dictation' ? voice.voiceMode : null}
					voiceElapsedMs={voice.elapsedMs}
					voiceMuted={voice.muted}
					voiceMediaStream={voice.stream}
					voiceAnalyser={null}
					voiceStatus={voice.status}
					voiceWaveformActive={true}
					onVoiceMutedChange={voice.setMuted}
					onVoiceCancel={() => void voice.cancel()}
					onVoiceConfirm={() => void voice.confirm()}
					onFilesChange={(files) => {
						setAttachments((current) => [...current, ...filesToAttachments(files)]);
					}}
					wrapperClassName="max-w-none"
					detachedControls
					footerContent={
						<div className="flex min-w-0 items-center text-[11px] text-muted-foreground">
							<StableModel
								messages={messages}
								draft={value}
								hasAttachments={attachments.length > 0}
								onContext={onContext}
							/>
						</div>
					}
					className="w-full"
					inputClassName={inputClassName}
					trailingAction={
						<PromptInputActions className="justify-end gap-1.5">
							<VoiceButton
								onVoiceModeRequest={() => void voice.start()}
								disabled={voice.busy || isLoading}
								disabledReason={voice.disabledReason}
								mode={voice.buttonMode}
							/>
							<PromptSubmit isLoading={isLoading} onAction={onSubmit} />
						</PromptInputActions>
					}
				/>
			</div>
			<LibraryPicker
				open={libraryPickerOpen}
				onOpenChange={setLibraryPickerOpen}
				onSelect={addLibraryFiles}
			/>
		</div>
	);
}
