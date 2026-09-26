import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodingProjectInstructions, CodingSettings } from '@shared/coding_types';

interface InstructionsState {
	readonly projectId?: string;
	readonly runtime?: CodingSettings['runtime'];
	readonly instructions?: CodingProjectInstructions;
	readonly content: string;
	readonly error: string;
}

export function useProjectInstructions(
	projectId: string | undefined,
	runtime?: CodingSettings['runtime']
) {
	const loadSequenceRef = useRef(0);
	const [state, setState] = useState<InstructionsState>({
		content: '',
		error: '',
	});
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const requests = loadSequenceRef;
		const sequence = ++requests.current;
		if (!projectId) return;
		void window.coder
			.getProjectInstructions(projectId, runtime)
			.then((next) => {
				if (sequence !== loadSequenceRef.current) return;
				setState({
					projectId,
					runtime,
					instructions: next,
					content: next.content,
					error: '',
				});
			})
			.catch((reason) => {
				if (sequence !== loadSequenceRef.current) return;
				setState({
					projectId,
					runtime,
					content: '',
					error: reason instanceof Error ? reason.message : 'Unable to load project instructions.',
				});
			});
		return () => {
			requests.current++;
		};
	}, [projectId, runtime]);

	const current =
		state.projectId === projectId && state.runtime === runtime ? state : { content: '', error: '' };
	const instructions = current.instructions;
	const content = current.content;
	const loading = Boolean(
		projectId && (state.projectId !== projectId || state.runtime !== runtime)
	);
	const dirty = Boolean(instructions && content !== instructions.content);
	const canSave = Boolean(
		projectId && instructions?.editable && !loading && !saving && (dirty || !instructions.exists)
	);

	const save = useCallback(async (): Promise<void> => {
		if (!projectId || !instructions || !canSave) return;
		const submittedContent = content;
		const sequence = loadSequenceRef.current;
		setSaving(true);
		setState((value) =>
			value.projectId === projectId && value.runtime === runtime ? { ...value, error: '' } : value
		);
		try {
			const next = await window.coder.saveProjectInstructions(
				projectId,
				{
					content: submittedContent,
					expectedRevision: instructions.revision,
				},
				runtime
			);
			if (sequence !== loadSequenceRef.current) return;
			setState((value) =>
				value.projectId === projectId && value.runtime === runtime
					? {
							...value,
							instructions: next,
							content: value.content === submittedContent ? next.content : value.content,
						}
					: value
			);
		} catch (reason) {
			if (sequence !== loadSequenceRef.current) return;
			setState((value) =>
				value.projectId === projectId && value.runtime === runtime
					? {
							...value,
							error:
								reason instanceof Error ? reason.message : 'Unable to save project instructions.',
						}
					: value
			);
		} finally {
			setSaving(false);
		}
	}, [canSave, content, instructions, projectId, runtime]);
	const setContent = useCallback(
		(value: string): void => {
			setState((currentState) =>
				currentState.projectId === projectId && currentState.runtime === runtime
					? { ...currentState, content: value }
					: currentState
			);
		},
		[projectId, runtime]
	);

	return {
		instructions,
		content,
		loading,
		saving,
		error: current.error,
		dirty,
		canSave,
		save,
		setContent,
	};
}
