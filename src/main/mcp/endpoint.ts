export function resolveMcpEndpoint(value: string, required = false): string {
	const url = new URL(value);
	if (
		url.origin !== 'https://agent365.svc.cloud.microsoft' ||
		!/^\/agents\/tenants\/(?:%7BtenantId%7D|\{tenantId\})\/servers\/[^/]+\/?$/i.test(url.pathname)
	) return value;
	const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();
	if (!tenantId) {
		if (required) throw new Error('Set MICROSOFT_TENANT_ID in .env before connecting Microsoft 365 MCP servers.');
		return value;
	}
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(tenantId)) {
		if (required) throw new Error('MICROSOFT_TENANT_ID must be a nonzero Microsoft Entra Directory (tenant) ID.');
		return value;
	}
	url.pathname = url.pathname.replace(/%7BtenantId%7D|\{tenantId\}/i, tenantId);
	return url.href;
}
