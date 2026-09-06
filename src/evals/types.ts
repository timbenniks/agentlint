export type EvalTraceEventType =
  | "eval.started"
  | "sandbox.created"
  | "runner.started"
  | "runner.output"
  | "runner.trace"
  | "runner.completed"
  | "validator.started"
  | "validator.completed"
  | "sandbox.removed"
  | "eval.completed";

export interface EvalTraceEvent {
  sequence: number;
  timestamp: string;
  type: EvalTraceEventType;
  data?: Record<string, unknown>;
}

export interface EvalWorkspaceDefinition {
  source?: string;
}

export interface EvalValidatorBase {
  id: string;
  title?: string;
  weight?: number;
}

export interface FileExistsValidatorDefinition extends EvalValidatorBase {
  type: "file-exists";
  path: string;
}

export interface FileContainsValidatorDefinition extends EvalValidatorBase {
  type: "file-contains";
  path: string;
  contains: string;
}

export interface JsonSchemaValidatorDefinition extends EvalValidatorBase {
  type: "json-schema";
  path: string;
  schema: Record<string, unknown>;
}

export interface CommandValidatorDefinition extends EvalValidatorBase {
  type: "command";
  command: string;
  args?: string[];
  expectedExitCode?: number;
  timeoutMs?: number;
}

export type EvalValidatorDefinition =
  | FileExistsValidatorDefinition
  | FileContainsValidatorDefinition
  | JsonSchemaValidatorDefinition
  | CommandValidatorDefinition;

export interface EvalTaskDefinition {
  schemaVersion: "1";
  id: string;
  title: string;
  description?: string;
  target?: string;
  prompt: string;
  workspace?: EvalWorkspaceDefinition;
  timeoutMs?: number;
  successThreshold?: number;
  validators: EvalValidatorDefinition[];
  metadata?: Record<string, unknown>;
}

export interface EvalRunnerInput {
  task: EvalTaskDefinition;
  prompt: string;
  workspacePath: string;
  target?: string;
  timeoutMs: number;
  onOutput?(stream: "stdout" | "stderr", chunk: string): void;
  onTrace?(name: string, data?: Record<string, unknown>): void;
}

export interface EvalRunnerResult {
  adapter: string;
  command?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal?: string;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  outputTruncated?: boolean;
  metrics?: Record<string, number>;
}

export interface EvalRunnerAdapter {
  readonly name: string;
  run(input: EvalRunnerInput): Promise<EvalRunnerResult>;
}

export interface EvalSandbox {
  readonly path: string;
  cleanup(): Promise<void>;
}

export interface EvalSandboxProvider {
  readonly name: string;
  create(source?: string): Promise<EvalSandbox>;
}

export interface EvalValidatorResult {
  id: string;
  title: string;
  type: EvalValidatorDefinition["type"];
  passed: boolean;
  weight: number;
  summary: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface EvalResult {
  schemaVersion: "1";
  agentlintVersion: string;
  evalId: string;
  task: {
    id: string;
    title: string;
    source: string;
    target?: string;
  };
  status: "pass" | "fail" | "error";
  score: number;
  threshold: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sandbox: {
    provider: string;
    path?: string;
    preserved: boolean;
  };
  runner: EvalRunnerResult;
  validators: EvalValidatorResult[];
  trace: EvalTraceEvent[];
  error?: string;
}

export interface EvalRunOptions {
  taskFile: string;
  runner: EvalRunnerAdapter;
  sandbox?: EvalSandboxProvider;
  target?: string;
  output: string;
  keepSandbox?: boolean;
  allowValidatorCommands?: boolean;
  timeoutMs?: number;
}
