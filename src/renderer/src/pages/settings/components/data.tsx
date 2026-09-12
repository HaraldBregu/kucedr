import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DataScope } from '../../../../../shared/data_types';
import { SettingsNotice, SettingsPanel, SettingsRow } from './index';
import { firstErrorMessage } from './model-configuration-state';

export type DataControlKind =
	| 'memory'
	| 'sessions'
	| 'local_index'
	| 'local_namespace'
	| 'remote_namespace'
	| 'remote_all_namespaces';

interface DataControlsProps {
	readonly kinds: readonly DataControlKind[];
}

const DATA_CONTROL_ITEMS = {
	memory: {
		titleKey: 'settings.dataControls.memory',
		descriptionKey: 'settings.dataControls.memoryDescription',
		exportable: true,
	},
	sessions: {
		titleKey: 'settings.dataControls.sessions',
		descriptionKey: 'settings.dataControls.sessionsDescription',
		exportable: true,
	},
	local_index: {
		titleKey: 'settings.dataControls.ragIndex',
		descriptionKey: 'settings.dataControls.ragIndexDescription',
		exportable: true,
	},
	local_namespace: {
		titleKey: 'settings.dataControls.ragNamespace',
		descriptionKey: 'settings.dataControls.ragNamespaceDescription',
		exportable: true,
	},
	remote_namespace: {
		titleKey: 'settings.dataControls.remoteNamespace',
		descriptionKey: 'settings.dataControls.remoteNamespaceDescription',
		exportable: false,
	},
	remote_all_namespaces: {
		titleKey: 'settings.dataControls.remoteAllNamespaces',
		descriptionKey: 'settings.dataControls.remoteAllNamespacesDescription',
		exportable: false,
	},
} as const satisfies Record<
	DataControlKind,
	{ readonly titleKey: string; readonly descriptionKey: string; readonly exportable: boolean }
>;

export function DataControls({ kinds }: DataControlsProps): React.JSX.Element {
	const { t } = useTranslation();
	const [scopes, setScopes] = useState<DataScope[] | null>(null);
	const [action, setAction] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		void window.dataControls.listScopes().then(
			(nextScopes) => {
				if (!mounted) return;
				setScopes(nextScopes);
				setError(null);
			},
			(loadError) => {
				if (mounted) setError(firstErrorMessage(loadError, t('settings.dataControls.loadError')));
			}
		);
		return () => {
			mounted = false;
		};
	}, [t]);

	const scopeFor = (kind: DataControlKind): DataScope | undefined => {
		return scopes?.find((scope) => {
				if (kind === 'memory' || kind === 'sessions') {
				return scope.kind === kind;
			}
			return scope.kind === 'rag' && scope.mode === kind;
		});
	};

	const handleAction = async (
		kind: DataControlKind,
		nextAction: 'export' | 'purge'
	): Promise<void> => {
		const scope = scopeFor(kind);
		if (!scope) return;
		setAction(`${kind}:${nextAction}`);
		setError(null);
		try {
			if (nextAction === 'export') await window.dataControls.export(scope);
			else {
				const preview = await window.dataControls.previewPurge(scope);
				const purged = await window.dataControls.purge(scope, preview.confirmationId);
				if (purged) setScopes(await window.dataControls.listScopes());
			}
		} catch (actionError) {
			setError(firstErrorMessage(actionError, t('settings.dataControls.actionError')));
		} finally {
			setAction(null);
		}
	};

	const actionsFor = (kind: DataControlKind, exportable: boolean) => (
		<>
			{exportable && (
				<Button
					variant="outline"
					size="sm"
					disabled={!scopeFor(kind) || action !== null}
					onClick={() => void handleAction(kind, 'export')}
				>
					<Download className="size-3" />
					{t('settings.dataControls.export')}
				</Button>
			)}
			<Button
				variant="destructive"
				size="sm"
				disabled={!scopeFor(kind) || action !== null}
				onClick={() => void handleAction(kind, 'purge')}
			>
				<Trash2 className="size-3" />
				{t('settings.dataControls.purge')}
			</Button>
		</>
	);

	return (
		<>
			{error && (
				<SettingsNotice variant="destructive" icon={AlertTriangle}>
					{error}
				</SettingsNotice>
			)}

			<SettingsPanel>
				{kinds.map((kind) => {
					const item = DATA_CONTROL_ITEMS[kind];
					const scope = scopeFor(kind);
					const count = scope?.kind === 'sessions' ? scope.sessionIds.length : 0;
					return (
						<SettingsRow
							key={kind}
							title={t(item.titleKey)}
							description={
								kind === 'sessions' ? t(item.descriptionKey, { count }) : t(item.descriptionKey)
							}
							actions={actionsFor(kind, item.exportable)}
						/>
					);
				})}
			</SettingsPanel>
		</>
	);
}
