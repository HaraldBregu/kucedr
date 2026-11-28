export class VaultError extends Error {
	constructor() {
		super('Encrypted data could not be opened with the system keystore.');
	}
}
