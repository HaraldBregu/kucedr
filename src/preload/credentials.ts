import type { CredentialsApi } from '../shared/credential_types';
import { CredentialChannels } from '../shared/ipc_channels_definitions';
import { typedInvokeUnwrap } from '../shared/ipc_types';

export const credentials: CredentialsApi = {
	list: () => typedInvokeUnwrap(CredentialChannels.list),
	create: (input) => typedInvokeUnwrap(CredentialChannels.create, input),
	replace: (id, secret) => typedInvokeUnwrap(CredentialChannels.replace, id, secret),
	rename: (id, label) => typedInvokeUnwrap(CredentialChannels.rename, id, label),
	test: (id) => typedInvokeUnwrap(CredentialChannels.test, id),
	remove: (id) => typedInvokeUnwrap(CredentialChannels.remove, id),
	listLocal: () => typedInvokeUnwrap(CredentialChannels.listLocal),
	migrate: (localIds) => typedInvokeUnwrap(CredentialChannels.migrate, localIds),
	removeLocal: (localId) => typedInvokeUnwrap(CredentialChannels.removeLocal, localId),
};
