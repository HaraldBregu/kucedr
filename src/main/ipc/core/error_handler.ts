import type { IpcMainInvokeEvent } from 'electron';

// Re-export shared IPC result type for backward compatibility
export type { IpcResult } from '../../../shared/ipc_types';

// Import the types we need locally
import type { IpcResult } from '../../../shared/ipc_types';
import { toError } from './error';
import { workspaceScope } from '../../workspaces/scope';
import { senderWorkspace } from '../../workspaces/sender';

/**
 * Wraps an IPC handler with standardized error handling
 *
 * @param handler - The IPC handler function to wrap
 * @param handlerName - Name of the handler for logging purposes
 * @returns Wrapped handler that returns IpcResult
 *
 * @example
 * ```typescript
 * ipcMain.handle('my-handler', wrapIpcHandler(
 *   async (event, arg1, arg2) => {
 *     // Your handler logic
 *     return result
 *   },
 *   'my-handler'
 * ))
 * ```
 */
export function wrapIpcHandler<TArgs extends unknown[], TResult>(
	handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> | TResult,
	handlerName: string
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<IpcResult<TResult>> {
	return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<IpcResult<TResult>> => {
		try {
			const workspace = senderWorkspace(event.sender);
			const result = await (workspace
				? workspaceScope.run(workspace, () => handler(event, ...args))
				: handler(event, ...args));
			return { success: true, data: result };
		} catch (err) {
			const error = toError(err, `${handlerName} failed.`);
			console.error(`[IPC Error] ${handlerName}:`, error);
			return {
				success: false,
				error: {
					code: error.name || 'UnknownError',
					message: error.message,
					stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
				},
			};
		}
	};
}

/**
 * Wraps a simple handler (without event parameter) with standardized error handling
 *
 * @param handler - The handler function to wrap (without event parameter)
 * @param handlerName - Name of the handler for logging purposes
 * @returns Wrapped handler that returns IpcResult
 *
 * @example
 * ```typescript
 * ipcMain.handle('my-handler', wrapSimpleHandler(
 *   async (arg1, arg2) => {
 *     // Your handler logic
 *     return result
 *   },
 *   'my-handler'
 * ))
 * ```
 */
export function wrapSimpleHandler<TArgs extends unknown[], TResult>(
	handler: (...args: TArgs) => Promise<TResult> | TResult,
	handlerName: string
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<IpcResult<TResult>> {
	return wrapIpcHandler<TArgs, TResult>((_event, ...args) => handler(...args), handlerName);
}
