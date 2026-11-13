import { useState, type ReactElement } from 'react';
import type { AgentModeInfo } from '@shared/agent_types';
import {
	PromptInput,
	usePromptInput,
	type PromptInputProps,
} from '@/components/ui/prompt-input';
import { TextEditor } from './text-editor';

export type PromptEditorProps = Omit<PromptInputProps, 'children'> & {
	readonly placeholder?: string;
	readonly ariaLabel?: string;
	readonly modes?: readonly AgentModeInfo[];
	readonly modeIds?: readonly string[];
	readonly onModeIdsChange?: (modeIds: string[]) => void;
	readonly hideEditor?: boolean;
};

function PromptEditorArea({
	placeholder,
	ariaLabel,
	onVisualLineChange,
	modes,
	modeIds,
	onModeIdsChange,
}: {
	readonly placeholder?: string;
	readonly ariaLabel?: string;
	readonly onVisualLineChange?: (hasMultipleLines: boolean) => void;
	readonly modes?: readonly AgentModeInfo[];
	readonly modeIds?: readonly string[];
	readonly onModeIdsChange?: (modeIds: string[]) => void;
}): ReactElement {
	const { value, setValue, onSubmit, disabled, textareaRef } = usePromptInput();

	const editor = (
		<TextEditor
			value={value}
			onValueChange={setValue}
			onSubmit={onSubmit}
			disabled={disabled}
			placeholder={placeholder}
			ariaLabel={ariaLabel}
			onVisualLineChange={onVisualLineChange}
			modes={modes}
			modeIds={modeIds}
			onModeIdsChange={onModeIdsChange}
			onEditorReady={(editor) => {
				// ponytail: PromptInput uses this ref to focus the editor and locate its container
				textareaRef.current = editor.view.dom as unknown as HTMLTextAreaElement;
			}}
			className="max-h-[34vh] min-h-6 overflow-y-auto text-base leading-6 text-foreground"
		/>
	);

	return modes && onModeIdsChange ? (
		<PromptSlash modes={modes} modeIds={modeIds ?? []} onModeIdsChange={onModeIdsChange}>
			{editor}
		</PromptSlash>
	) : (
		editor
	);
}

function PromptEditor({
	placeholder,
	ariaLabel,
	modes,
	modeIds,
	onModeIdsChange,
	expanded,
	value,
	hideEditor,
	...props
}: PromptEditorProps): ReactElement {
	const [hasMultipleVisualLines, setHasMultipleVisualLines] = useState(false);
	const autoExpand = expanded === undefined;

	return (
		<PromptInput
			expanded={expanded ?? (value !== '' && hasMultipleVisualLines)}
			value={value}
			{...props}
		>
			{hideEditor ? null : <PromptEditorArea
				placeholder={placeholder}
				ariaLabel={ariaLabel}
				onVisualLineChange={autoExpand ? setHasMultipleVisualLines : undefined}
				modes={modes}
				modeIds={modeIds}
				onModeIdsChange={onModeIdsChange}
			/>}
		</PromptInput>
	);
}

export { PromptEditor };
