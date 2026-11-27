import type { MemoryService } from '../../shared/memory_types';
import type { Workspace } from '../workspaces/types';
import { memories } from './all';
import { createMemory } from './index';

export function memoryFor(workspace: Workspace): MemoryService {
	let memory = memories.get(workspace.memory);
	if (!memory) {
		memory = createMemory(workspace);
		memories.set(workspace.memory, memory);
		void memory.start().catch(() => undefined);
	}
	return memory;
}
