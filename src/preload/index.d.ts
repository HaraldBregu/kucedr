export type * from '../shared/api_types';

import type {
	AgentApi,
	CodingApi,
	A2aApi,
	AppApi,
	RecorderApi,
	TaskApi,
	McpApi,
	ModelsApi,
	ProviderApi,
	SearchApi,
	SkillsApi,
	StorageApi,
	DatabaseApi,
	AppsApi,
	WikiApi,
	WindowApi,
	DataApi,
	TerminalApi,
	AuthApi,
	CloudApi,
} from '../shared/api_types';

declare global {
	interface Window {
		win: WindowApi;
		app: AppApi;
		agent: AgentApi;
		coder: CodingApi;
		a2a: A2aApi;
		recorder: RecorderApi;
		tasks: TaskApi;
		skills: SkillsApi;
		mcp: McpApi;
		models: ModelsApi;
		storage: StorageApi;
		database: DatabaseApi;
		provider: ProviderApi;
		search: SearchApi;
		apps: AppsApi;
		wiki: WikiApi;
		dataControls: DataApi;
		terminalAPI: TerminalApi;
		auth: AuthApi;
		cloud: CloudApi;
	}
}
