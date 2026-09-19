import type { MemoryService } from '../../shared/memory_types';
import { MemoryChannels } from '../../shared/ipc_channels_definitions';
import type { WindowContextManager } from '../window_context';
import type { AppRegistry } from '../apps/app_registry';
import { registerCommandWithEvent, registerQueryWithEvent } from './core/gateway';
import { TrustedRenderer } from './core/trusted';
export class MemoryIpc {
 readonly name = 'memory';
 register({ windows, apps, memory }: { windows: WindowContextManager; apps: AppRegistry; memory: MemoryService }): void {
  const trusted = new TrustedRenderer(windows, apps);
  registerQueryWithEvent(MemoryChannels.getConfig, (event) => { trusted.assert(event); return memory.getConfig(); });
  registerCommandWithEvent(MemoryChannels.configure, (event, patch: Partial<MemoryConfig>) => { trusted.assert(event); return memory.configure(patch); });
  registerCommandWithEvent(MemoryChannels.refresh, (event) => { trusted.assert(event); return memory.refresh(); });
  registerQueryWithEvent(MemoryChannels.status, (event) => { trusted.assert(event); return memory.status(); });
  registerQueryWithEvent(MemoryChannels.list, (event) => { trusted.assert(event); return memory.list(); });
  registerQueryWithEvent(MemoryChannels.read, (event) => { trusted.assert(event); return memory.read(); });
  registerCommandWithEvent(MemoryChannels.edit, (event, markdown: string) => { trusted.assert(event); return memory.edit(markdown); });
  registerCommandWithEvent(MemoryChannels.forget, (event, id: string) => { trusted.assert(event); return memory.forget(id); });
  registerCommandWithEvent(MemoryChannels.clear, (event) => { trusted.assert(event); return memory.clear(); });
 }
}
