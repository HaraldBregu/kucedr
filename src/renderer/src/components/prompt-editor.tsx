import { useState, type ReactElement } from 'react';
import {
	PromptInput,
	usePromptInput,
	type PromptInputProps,
} from '@/components/ui/prompt-input';
import { TextEditor } from './text-editor';

export type PromptEditorProps = Omit<PromptInputProps, 'children'> & {
	readonly placeholder?: string;
	readonly ariaLabel?: string;
	readonly onPlanCommandChange?: (active: boolean) => void;
	readonly onGoalCommandChange?: (active: boolean) => void;
};

function PromptEditorArea({
	placeholder,
	ariaLabel,
	onVisualLineChange,
	onPlanCommandChange,
	onGoalCommandChange,
}: {
	readonly placeholder?: string;
	readonly ariaLabel?: string;
	readonly onVisualLineChange: (hasMultipleLines: boolean) => void;
	readonly onPlanCommandChange?: (active: boolean) => void;
	readonly onGoalCommandChange?: (active: boolean) => void;
}): ReactElement {
	const { value, setValue, onSubmit, disabled, textareaRef } = usePromptInput();

	return (
		<TextEditor
			value={value}
			onValueChange={setValue}
			onSubmit={onSubmit}
			disabled={disabled}
			placeholder={placeholder}
			ariaLabel={ariaLabel}
			onVisualLineChange={onVisualLineChange}
			onPlanCommandChange={onPlanCommandChange}
			onGoalCommandChange={onGoalCommandChange}
			onEditorReady={(editor) => {
				// ponytail: PromptInput uses this ref to focus the editor and locate its container
				textareaRef.current = editor.view.dom as unknown as HTMLTextAreaElement;
			}}
			className="max-h-[34vh] min-h-7 overflow-y-auto text-sm leading-6 text-foreground"
		/>
	);
}

function PromptEditor({
	placeholder,
	ariaLabel,
	onPlanCommandChange,
	onGoalCommandChange,
	expanded,
	value,
	...props
}: PromptEditorProps): ReactElement {
	const [hasMultipleVisualLines, setHasMultipleVisualLines] = useState(false);

	return (
		<PromptInput
			expanded={expanded || (value !== '' && hasMultipleVisualLines)}
			value={value}
			{...props}
		>
			<PromptEditorArea
				placeholder={placeholder}
				ariaLabel={ariaLabel}
				onVisualLineChange={setHasMultipleVisualLines}
				onPlanCommandChange={onPlanCommandChange}
				onGoalCommandChange={onGoalCommandChange}
			/>
		</PromptInput>
	);
}

export { PromptEditor };
