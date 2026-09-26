import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodingProjectInstructions } from '@shared/coding_types';

interface InstructionsState {
	readonly projectId?: string;
	readonly instructions?: CodingProjectInstructions;
	readonly content: string;
	readonly error: string;
}

export function useProjectInstructions(projectId: string | undefined) {
	const loadSequenceRef = useRef(0);
	const [state, setState] = useState<InstructionsState>({ content: '', error: '' });
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const requests = loadSequenceRef;
		const sequence = ++requests.current;
		if (!projectId) return;
		void window.coding
			.getProjectInstructions(projectId)
			.then((next) => {
				if (sequence !== loadSequenceRef.current) return;
				setState({ projectId, instructions: next, content: next.content, error: '' });
			})
			.catch((reason) => {
				if (sequence !== loadSequenceRef.current) return;
				setState({
					projectId,
					content: '',
					error: reason instanceof Error ? reason.message : 'Unable to load project instructions.',
				});
			});
		return () => {
			requests.current++;
		};
	}, [projectId]);

	const current = state.projectId === projectId ? state : { content: '', error: '' };
	const instructions = current.instructions;
	const content = current.content;
	const loading = Boolean(projectId && state.projectId !== projectId);
	const dirty = Boolean(instructions && content !== instructions.content);
	const canSave = Boolean(
		projectId && instructions?.editable && !loading && !saving && (dirty || !instructions.exists)
	);

	const save = useCallback(async (): Promise<void> => {
		if (!projectId || !instructions || !canSave) return;
		const submittedContent = content;
		setSaving(true);
		setState((value) => (value.projectId === projectId ? { ...value, error: '' } : value));
		try {
			const next = await window.coding.saveProjectInstructions(projectId, {
				content: submittedContent,
				expectedRevision: instructions.revision,
			});
			setState((value) =>
				value.projectId === projectId
					? {
							...value,
							instructions: next,
							content: value.content === submittedContent ? next.content : value.content,
						}
					: value
			);
		} catch (reason) {
			setState((value) =>
				value.projectId === projectId
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
	}, [canSave, content, instructions, projectId]);
	const setContent = useCallback(
		(value: string): void => {
			setState((currentState) =>
				currentState.projectId === projectId ? { ...currentState, content: value } : currentState
			);
		},
		[projectId]
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
