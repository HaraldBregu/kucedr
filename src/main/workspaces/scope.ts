import { AsyncLocalStorage } from 'node:async_hooks';
import type { Workspace } from './types';

export const workspaceScope = new AsyncLocalStorage<Workspace>();
