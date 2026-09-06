import type { Command } from "commander";

export interface AgentlintModule {
  /** Stable machine-readable module id used by integrations and documentation. */
  readonly id: string;
  /** Top-level CLI command owned by the module. */
  readonly command: string;
  readonly description: string;
  register(program: Command): void;
}
