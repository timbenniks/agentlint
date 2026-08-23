import { defineCheck, warn } from "./helpers.ts";
import { evidence } from "../engine/util.ts";
import {
  contentDiscoveryMission,
  instructionBoundaryMission,
  recoveryMission,
  toolPlanningMission,
} from "../reasoning/tasks.ts";

export const contentDiscoveryMissionCheck = defineCheck({
  id: "mission-content-discovery",
  title: "bounded content discovery mission",
  category: "understanding",
  provenance: "JOURNEY",
  severity: "recommended",
  applicability: (ctx) => ctx.pages.length > 0
    ? { applicable: true }
    : { applicable: false, reason: "No pages were collected for a content mission." },
  run(ctx) {
    const task = contentDiscoveryMission(ctx);
    return warn("A coding agent must complete the grounded content-discovery mission.", [
      evidence("text", ctx.target.finalUrl, { taskId: task.id, evidenceSources: ctx.pages.length }),
    ], undefined, { reasoningTask: task });
  },
});

export const safeToolPlanMissionCheck = defineCheck({
  id: "mission-safe-tool-plan",
  title: "bounded safe tool-planning mission",
  category: "developer",
  provenance: "JOURNEY",
  severity: "recommended",
  applicability: (ctx) => ctx.discovered.openApi?.valid
    ? { applicable: true }
    : { applicable: false, reason: "No valid OpenAPI document is available for a tool-planning mission." },
  run(ctx) {
    const task = toolPlanningMission(ctx);
    return warn("A coding agent must construct a grounded, read-only tool plan.", [
      evidence("openapi", ctx.discovered.openApi?.url ?? ctx.target.origin, { taskId: task.id, operations: ctx.discovered.openApi?.operations.length }),
    ], undefined, { reasoningTask: task });
  },
});

export const instructionBoundaryMissionCheck = defineCheck({
  id: "mission-instruction-boundaries",
  title: "bounded instruction-boundary mission",
  category: "security",
  provenance: "JOURNEY",
  severity: "recommended",
  applicability: (ctx) => ctx.discovered.agentsMd || ctx.discovered.llmsTxt
    ? { applicable: true }
    : { applicable: false, reason: "No agent guidance was discovered for an instruction-boundary mission." },
  run(ctx) {
    const task = instructionBoundaryMission(ctx);
    return warn("A coding agent must distinguish site guidance from untrusted page content.", [
      evidence("text", ctx.discovered.agentsMd?.url ?? ctx.discovered.llmsTxt?.url ?? ctx.target.origin, { taskId: task.id }),
    ], undefined, { reasoningTask: task });
  },
});

export const recoveryMissionCheck = defineCheck({
  id: "mission-recovery",
  title: "bounded failure-recovery mission",
  category: "reliability",
  provenance: "JOURNEY",
  severity: "recommended",
  applicability: (ctx) => ctx.discovered.notFound
    ? { applicable: true }
    : { applicable: false, reason: "No missing-resource response was collected." },
  run(ctx) {
    const task = recoveryMission(ctx);
    return warn("A coding agent must recover from a missing resource without inventing one.", [
      evidence("http", ctx.discovered.notFound?.url ?? ctx.target.origin, { taskId: task.id, status: ctx.discovered.notFound?.status }),
    ], undefined, { reasoningTask: task });
  },
});

export const missionChecks = [
  contentDiscoveryMissionCheck,
  safeToolPlanMissionCheck,
  instructionBoundaryMissionCheck,
  recoveryMissionCheck,
];
