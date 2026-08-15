import { AgentRequest, AgentResult } from '../domain/orchestration-contracts';

export interface IAgentExecutor {
  execute(request: AgentRequest): Promise<AgentResult>;
}

export class MockAgentExecutor implements IAgentExecutor {
  private predefinedResults: Map<string, AgentResult>;

  constructor(predefinedResults: Map<string, AgentResult> = new Map()) {
    this.predefinedResults = predefinedResults;
  }

  public registerMock(role: string, result: AgentResult) {
    this.predefinedResults.set(role, result);
  }

  async execute(request: AgentRequest): Promise<AgentResult> {
    const mockResult = this.predefinedResults.get(request.role);
    
    if (mockResult) {
      return { ...mockResult, run_id: request.run_id, role: request.role };
    }

    // Default mock behavior if not overridden
    return {
      run_id: request.run_id,
      agent_id: `mock-agent-${Date.now()}`,
      role: request.role,
      status: 'FAILURE',
      challenges: ['NO_CONFIGURED_RESULT: MockAgentExecutor must be explicitly configured to prevent artificial GREENs.']
    };
  }
}

export class SubprocessAgentExecutor implements IAgentExecutor {
  async execute(request: AgentRequest): Promise<AgentResult> {
    // In future phases, this will use child_process.spawn to run a standalone script.
    // For now, it returns a FAILED placeholder as we will strictly use MockAgentExecutor for EXPERIMENT-0002 logic tests.
    return {
      run_id: request.run_id,
      agent_id: 'subprocess-worker',
      role: request.role,
      status: 'FAILURE',
      challenges: ['Subprocess implementation pending LLM architecture']
    };
  }
}
