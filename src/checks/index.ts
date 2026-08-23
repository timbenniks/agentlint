import { discoveryChecks } from "./discovery.ts";
import { accessChecks } from "./access.ts";
import { understandingChecks } from "./understanding.ts";
import { developerChecks } from "./developer.ts";
import { operationChecks } from "./operation.ts";
import { reliabilityChecks } from "./reliability.ts";
import type { Check } from "../types.ts";

export const allChecks: Check[] = [
  ...discoveryChecks,
  ...accessChecks,
  ...understandingChecks,
  ...developerChecks,
  ...operationChecks,
  ...reliabilityChecks,
];
