import { resolveMcpEndpoint } from './endpoint';
import { loadMcps } from '../models';
import { findCatalogMcpService } from '../../shared/mcp_catalog';

export function findMcpService(url: string) {
	return findCatalogMcpService(resolveMcpEndpoint(url), loadMcps());
}
