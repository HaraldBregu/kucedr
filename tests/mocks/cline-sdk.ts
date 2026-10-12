export const completeClineDeviceAuth = jest.fn();
export const createBuiltinTools = jest.fn(() => []);
export const getValidClineCredentials = jest.fn();
export const peekClineRecommendedModels = jest.fn(async () => []);
export const startClineDeviceAuth = jest.fn();

export class Agent {
	static readonly instances: Agent[] = [];
	readonly options: unknown;

	constructor(options: unknown) {
		this.options = options;
		Agent.instances.push(this);
	}
}
