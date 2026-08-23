import type { Check, CheckResult, Evidence, Recommendation, ScanContext } from "../types.ts";

export function defineCheck(check: Check): Check {
  return check;
}

export function pass(summary: string, evidence: Evidence[], extra?: Partial<CheckResult>): CheckResult {
  return { status: "pass", summary, evidence, ...extra };
}

export function fail(
  summary: string,
  evidence: Evidence[],
  recommendation?: Recommendation,
  extra?: Partial<CheckResult>,
): CheckResult {
  return { status: "fail", summary, evidence, recommendation, ...extra };
}

export function warn(
  summary: string,
  evidence: Evidence[],
  recommendation?: Recommendation,
  extra?: Partial<CheckResult>,
): CheckResult {
  return { status: "warning", summary, evidence, recommendation, ...extra };
}

export function na(summary: string, evidence: Evidence[] = []): CheckResult {
  return { status: "na", summary, evidence };
}

export function always(): { applicable: true } {
  return { applicable: true };
}

export function when(
  predicate: (ctx: ScanContext) => boolean,
  reason: string,
) {
  return (ctx: ScanContext) =>
    predicate(ctx) ? { applicable: true as const } : { applicable: false as const, reason };
}
