import type { Recorder } from '../../recorder';
import { executionScope, type ExecutionScope } from '../execution/scope';
import { recordingOwners } from './store';

export function recordingOwner(recorder: Recorder, id?: string): ExecutionScope {
	const scope = executionScope.getStore();
	if (!scope) throw new Error('Recording access requires an owning session.');
	if (id) {
		const owner = recordingOwners.get(recorder)?.get(id);
		if (!owner || owner.ownerId !== scope.ownerId || owner.source !== scope.source || owner.sessionId !== scope.sessionId)
			throw new Error('Recording is not owned by this session.');
	}
	return scope;
}
