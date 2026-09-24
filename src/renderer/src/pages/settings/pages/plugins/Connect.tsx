import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CatalogService } from '@shared/provider_types';
import { MICROSOFT_365_SERVICES } from './Microsoft';

export function MicrosoftConnect({
	service,
	onClose,
	onConnect,
	saving,
	error,
}: {
	readonly service: CatalogService | null;
	readonly onClose: () => void;
	readonly onConnect: (url: string, clientId: string) => Promise<boolean>;
	readonly saving: boolean;
	readonly error: string;
}): React.JSX.Element {
	const { t } = useTranslation();
	const [tenantId, setTenantId] = useState('');
	const [clientId, setClientId] = useState('');
	const server = MICROSOFT_365_SERVICES.find((entry) => entry.id === service?.id);
	const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const canConnect = Boolean(server && valid.test(tenantId.trim()) && valid.test(clientId.trim()));

	return (
		<Dialog open={Boolean(service)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t('settings.integrations.microsoft.title', { name: service?.name })}
					</DialogTitle>
					<DialogDescription>{t('settings.integrations.microsoft.description')}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<div className="grid gap-2">
						<Label htmlFor="microsoft-tenant-id">
							{t('settings.integrations.microsoft.tenantId')}
						</Label>
						<Input
							id="microsoft-tenant-id"
								value={tenantId}
								onChange={(event) => setTenantId(event.target.value)}
								placeholder="00000000-0000-0000-0000-000000000000"
								spellCheck={false}
							/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="microsoft-client-id">
							{t('settings.integrations.microsoft.clientId')}
						</Label>
						<Input
								id="microsoft-client-id"
								value={clientId}
								onChange={(event) => setClientId(event.target.value)}
								placeholder="00000000-0000-0000-0000-000000000000"
								spellCheck={false}
							/>
					</div>
					<p className="text-xs text-muted-foreground">
						{t('settings.integrations.microsoft.requirements')}
					</p>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={saving}>
						{t('common.cancel')}
					</Button>
					<Button
						disabled={!canConnect || saving}
						onClick={() => {
							if (!server) return;
							const url = `https://agent365.svc.cloud.microsoft/agents/tenants/${tenantId.trim()}/servers/${server.serverId}`;
							void onConnect(url, clientId.trim()).then((connected) => {
								if (connected) onClose();
							});
						}}
					>
						{t('settings.integrations.microsoft.add')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
