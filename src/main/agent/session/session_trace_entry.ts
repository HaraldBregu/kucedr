export function semanticRunEntry(entry: unknown): Record<string, unknown> | undefined {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { type: 'invalid_event' };
	const event = entry as Record<string, unknown>;
	if (typeof event.type !== 'string') return { type: 'invalid_event' };
	if (
		event.type === 'model_call_delta' ||
		event.type === 'model_provider_item' ||
		event.type === 'model_tool_call_args_delta'
	) {
		return undefined;
	}
	if (event.type === 'run_started') {
		const mcp =
			event.mcpDiscovery &&
			typeof event.mcpDiscovery === 'object' &&
			!Array.isArray(event.mcpDiscovery)
				? (event.mcpDiscovery as Record<string, unknown>)
				: undefined;
		return {
			type: event.type,
			...(typeof event.sessionId === 'string' ? { sessionId: event.sessionId } : {}),
			...(typeof event.model === 'string' ? { model: event.model } : {}),
			...(typeof event.providerId === 'string' ? { providerId: event.providerId } : {}),
			...(typeof event.interactionMode === 'string'
				? { interactionMode: event.interactionMode }
				: {}),
			toolCount: Array.isArray(event.tools) ? event.tools.length : 0,
			skillDiagnosticCount: Array.isArray(event.skillDiagnostics)
				? event.skillDiagnostics.length
				: 0,
			skillActivations: Array.isArray(event.skillActivations)
				? event.skillActivations.slice(0, 16).map((activation) => {
						const skill = activation as Record<string, unknown>;
						return {
							...(typeof skill.id === 'string' ? { id: skill.id } : {}),
							...(typeof skill.name === 'string' ? { name: skill.name } : {}),
							...(typeof skill.hash === 'string' ? { hash: skill.hash } : {}),
							...(typeof skill.trust === 'string' ? { trust: skill.trust } : {}),
						};
					})
				: [],
			...(mcp
				? {
						mcpDiscovery: {
							configuredServers: Number(mcp.configuredServers) || 0,
							enabledServers: Number(mcp.enabledServers) || 0,
							connectedServers: Number(mcp.connectedServers) || 0,
							listedTools: Number(mcp.listedTools) || 0,
							loadedTools: Number(mcp.loadedTools) || 0,
							rejectedTools: Number(mcp.rejectedTools) || 0,
							truncated: mcp.truncated === true,
							failures: Array.isArray(mcp.failures)
								? mcp.failures.slice(0, 32).map((failure) => {
										const issue = failure as Record<string, unknown>;
										return {
											serverId: typeof issue.serverId === 'string' ? issue.serverId : 'unknown',
											phase: typeof issue.phase === 'string' ? issue.phase : 'unknown',
											...(typeof issue.toolName === 'string' ? { toolName: issue.toolName } : {}),
										};
									})
								: [],
						},
					}
				: {}),
		};
	}
	if (event.type === 'assistant_message') {
		return {
			type: event.type,
			contentChars: typeof event.content === 'string' ? event.content.length : 0,
			toolCallCount: Array.isArray(event.toolCalls) ? event.toolCalls.length : 0,
		};
	}
	if (event.type === 'model_call_start' || event.type === 'model_call_end') {
		const usage =
			event.usage && typeof event.usage === 'object' && !Array.isArray(event.usage)
				? (event.usage as Record<string, unknown>)
				: undefined;
		return {
			type: event.type,
			...(typeof event.model === 'string' ? { model: event.model } : {}),
			...(typeof event.effort === 'string' ? { effort: event.effort } : {}),
			...(typeof event.stopReason === 'string' ? { stopReason: event.stopReason } : {}),
			...(typeof event.durationMs === 'number' ? { durationMs: event.durationMs } : {}),
			...(typeof event.firstTokenLatencyMs === 'number'
				? { firstTokenLatencyMs: event.firstTokenLatencyMs }
				: {}),
			...(typeof event.retryCount === 'number' ? { retryCount: event.retryCount } : {}),
			...(usage
				? {
						usage: {
							...(typeof usage.inputTokens === 'number' ? { inputTokens: usage.inputTokens } : {}),
							...(typeof usage.outputTokens === 'number'
								? { outputTokens: usage.outputTokens }
								: {}),
						},
					}
				: {}),
		};
	}
	if (event.type === 'tool_call_start' || event.type === 'model_tool_call_start') {
		return {
			type: event.type,
			...(typeof event.toolCallId === 'string' ? { toolCallId: event.toolCallId } : {}),
			...(typeof event.id === 'string' ? { id: event.id } : {}),
			...(typeof event.toolName === 'string' ? { toolName: event.toolName } : {}),
			...(typeof event.name === 'string' ? { name: event.name } : {}),
		};
	}
	if (event.type === 'tool_call_end') {
		const output =
			event.output && typeof event.output === 'object' && !Array.isArray(event.output)
				? (event.output as Record<string, unknown>)
				: undefined;
		return {
			type: event.type,
			...(typeof event.toolCallId === 'string' ? { toolCallId: event.toolCallId } : {}),
			...(typeof event.toolName === 'string' ? { toolName: event.toolName } : {}),
			...(typeof event.isError === 'boolean' ? { isError: event.isError } : {}),
			...(typeof event.durationMs === 'number' ? { durationMs: event.durationMs } : {}),
			...(typeof event.permissionOutcome === 'string'
				? { permissionOutcome: event.permissionOutcome }
				: {}),
			...(event.toolName === 'load_skill' && output?.activated === true
				? {
						skillActivation: {
							...(typeof output.id === 'string' ? { id: output.id } : {}),
							...(typeof output.hash === 'string' ? { hash: output.hash } : {}),
						},
					}
				: {}),
		};
	}
	if (event.type === 'run_queue_metrics') {
		return {
			type: event.type,
			...(typeof event.queueDelayMs === 'number' ? { queueDelayMs: event.queueDelayMs } : {}),
		};
	}
	if (event.type === 'provider_queue_metrics') {
		return {
			type: event.type,
			...(typeof event.providerId === 'string' ? { providerId: event.providerId } : {}),
			...(typeof event.queueDelayMs === 'number' ? { queueDelayMs: event.queueDelayMs } : {}),
			...(typeof event.attempt === 'number' ? { attempt: event.attempt } : {}),
		};
	}
	if (event.type === 'tool_permission_request') {
		return {
			type: event.type,
			...(typeof event.approvalId === 'string' ? { approvalId: event.approvalId } : {}),
			...(typeof event.toolCallId === 'string' ? { toolCallId: event.toolCallId } : {}),
			...(typeof event.toolName === 'string' ? { toolName: event.toolName } : {}),
			...(typeof event.expiresAt === 'string' ? { expiresAt: event.expiresAt } : {}),
		};
	}
	if (event.type === 'user_input_request' || event.type === 'user_input_result') {
		return {
			type: event.type,
			...(typeof event.requestId === 'string' ? { requestId: event.requestId } : {}),
			...(typeof event.toolCallId === 'string' ? { toolCallId: event.toolCallId } : {}),
			...(typeof event.status === 'string' ? { status: event.status } : {}),
			questionCount: Array.isArray(event.questions) ? event.questions.length : undefined,
			answerCount: Array.isArray(event.answers) ? event.answers.length : undefined,
		};
	}
	if (event.type === 'run_finished') {
		const result =
			event.result && typeof event.result === 'object' && !Array.isArray(event.result)
				? (event.result as Record<string, unknown>)
				: undefined;
		const usage =
			result?.usage && typeof result.usage === 'object' && !Array.isArray(result.usage)
				? (result.usage as Record<string, unknown>)
				: undefined;
		return {
			type: event.type,
			...(typeof result?.sessionId === 'string' ? { sessionId: result.sessionId } : {}),
			...(typeof result?.model === 'string' ? { model: result.model } : {}),
			...(typeof result?.subtype === 'string' ? { subtype: result.subtype } : {}),
			...(typeof result?.stopReason === 'string' ? { stopReason: result.stopReason } : {}),
			...(typeof result?.numTurns === 'number' ? { numTurns: result.numTurns } : {}),
			outputChars: typeof result?.text === 'string' ? result.text.length : 0,
			toolCallCount: Array.isArray(result?.toolCalls) ? result.toolCalls.length : 0,
			...(usage
				? {
						usage: {
							...(typeof usage.inputTokens === 'number' ? { inputTokens: usage.inputTokens } : {}),
							...(typeof usage.outputTokens === 'number'
								? { outputTokens: usage.outputTokens }
								: {}),
						},
					}
				: {}),
		};
	}
	if (event.type === 'run_error') return { type: event.type };
	return { type: event.type };
}
