import { getMcpServersState, setMcpServersState } from './mcp_store_state';
import { clearMcpToolCatalog } from './mcp_catalog_clear';

export function deleteMcpServer(id: string): void {
	setMcpServersState(getMcpServersState().filter((server) => server.id !== id));
	clearMcpToolCatalog(id);
}
