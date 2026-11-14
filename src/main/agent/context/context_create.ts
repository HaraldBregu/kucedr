import type { RunContext } from './context_types';

export function createRunContext(): RunContext {
	return {
		loadedSkills: [],
		skillsTracked: false,
		fileAccess: {
			readDirectories: new Set(),
			createdFiles: new Set(),
		},
		fileHistory: { operations: [] },
	};
}
