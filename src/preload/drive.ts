import { typedInvokeUnwrap } from '../shared/ipc_types';
import { DriveChannels } from '../shared/ipc_channels_definitions';
import type { DriveApi } from '../shared/api_types';
import { mcp } from './mcp';

export const drive: DriveApi = {
	status: () => typedInvokeUnwrap(DriveChannels.status),
	connect: async () => {
		const servers = await mcp.list();
		if (!servers['google-drive']) {
			await mcp.upsert('google-drive', {
				type: 'http',
				name: 'Google Drive',
				url: 'https://drivemcp.googleapis.com/mcp/v1',
				enabled: true,
			});
		}
		await mcp.oauthStart('google-drive');
	},
	list: (query, meetOnly) => typedInvokeUnwrap(DriveChannels.list, query, meetOnly),
	read: (id) => typedInvokeUnwrap(DriveChannels.read, id),
	create: (input) => typedInvokeUnwrap(DriveChannels.create, input),
	update: (id, input) => typedInvokeUnwrap(DriveChannels.update, id, input),
	trash: (id) => typedInvokeUnwrap(DriveChannels.trash, id),
	download: (id) => typedInvokeUnwrap(DriveChannels.download, id),
	chooseFolder: () => typedInvokeUnwrap(DriveChannels.chooseFolder),
	sync: (folderPath) => typedInvokeUnwrap(DriveChannels.sync, folderPath),
};
