import { BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { DataChannels } from '../../shared/ipc_channels_definitions';
import type { DataScope } from '../../shared/data_types';
import type { Agent } from '../agent/agent';
import { DataController } from '../data/data_controller';
import { normalizeDataScope } from '../data/data_scope';
import type { EventBus } from '../event_bus';
import type { IpcModule } from './core/module';
import type { AppRegistry } from '../apps/app_registry';
import type { WindowContextManager } from '../window_context';
import { TrustedRenderer } from './core/trusted';

export interface DataIpcDeps {
	agent: Agent;
	windows: WindowContextManager;
	apps: AppRegistry;
}

export class DataIpc implements IpcModule<DataIpcDeps> {
	readonly name = 'data';

	register({ agent, windows, apps }: DataIpcDeps, _eventBus: EventBus): void {
		const controller = new DataController(agent);
		const trusted = new TrustedRenderer(windows, apps);
		trusted.query(DataChannels.listScopes, () => controller.listScopes());
		trusted.commandWithEvent(DataChannels.export, async (event, input) => {
			const scope = normalizeDataScope(input);
			const options = {
				title: 'Export Kucedr data',
				defaultPath: `${this.fileName(scope)}.json`,
				filters: [{ name: 'Kucedr data export', extensions: ['json'] }],
			};
			const window = BrowserWindow.fromWebContents(event.sender);
			const result = await (window
				? dialog.showSaveDialog(window, options)
				: dialog.showSaveDialog(options));
			if (result.canceled || !result.filePath) return undefined;
			return controller.export(scope, path.resolve(result.filePath));
		});
		trusted.query(DataChannels.previewPurge, (input) => {
			return controller.previewPurge(normalizeDataScope(input));
		});
		trusted.commandWithEvent(DataChannels.purge, async (event, input, confirmationId) => {
			const scope = normalizeDataScope(input);
			const remoteNamespace =
				scope.kind === 'rag' &&
				(scope.mode === 'remote_namespace' || scope.mode === 'remote_all_namespaces');
			if (typeof confirmationId !== 'string' || !confirmationId.trim()) {
				throw new Error('A purge confirmation ID is required.');
			}
			const options = {
				type: 'warning' as const,
				buttons: ['Cancel', remoteNamespace ? 'Purge remote namespace' : 'Purge local data'],
				cancelId: 0,
				defaultId: 0,
				noLink: true,
				message: remoteNamespace
					? 'Permanently purge the selected remote data?'
					: 'Permanently purge the selected local data?',
					detail: `${this.scopeDescription(scope)}\n\n${
					remoteNamespace
						? scope.kind === 'rag' && scope.mode === 'remote_all_namespaces'
							? 'Every Kucedr-owned namespace in this remote vector index will be deleted. The index and unrelated namespaces will remain.'
							: 'Only this exact remote namespace will be deleted. The remote vector index will remain.'
						: 'Remote provider data will not be deleted.'
				}`,
			};
			const window = BrowserWindow.fromWebContents(event.sender);
			const result = await (window
				? dialog.showMessageBox(window, options)
				: dialog.showMessageBox(options));
			if (result.response !== 1) return undefined;
			return controller.purge(scope, confirmationId.trim());
		});
	}

	private fileName(scope: DataScope): string {
		if (scope.kind === 'sessions') return 'kucedr-sessions-export';
		if (scope.kind === 'wiki') return 'kucedr-wiki-export';
		if (scope.kind === 'memory') return 'kucedr-memory-export';
		return `kucedr-rag-${scope.indexName}-export`;
	}

	private scopeDescription(scope: DataScope): string {
		if (scope.kind === 'sessions') return `Sessions: ${scope.sessionIds.join(', ')}`;
		if (scope.kind === 'wiki') return `Managed wiki target: ${scope.targetPath}`;
		if (scope.kind === 'memory') return 'Persistent memory: all saved facts';
		if (scope.mode === 'local_namespace') {
			return `Local RAG namespace: ${scope.indexName} / ${scope.generation}`;
		}
		if (scope.mode === 'remote_namespace') {
			return `Remote vector database namespace: ${scope.indexName} / ${scope.generation}`;
		}
		if (scope.mode === 'remote_all_namespaces') {
			return `All Kucedr-owned remote vector database namespaces in ${scope.indexName}`;
		}
		return `Local RAG index: ${scope.indexName} (all local namespaces)`;
	}
}
