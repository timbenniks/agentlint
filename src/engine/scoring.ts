import type { CategoryScore, Check, CheckResult, ScanContext, Scorecard, ScoredCheck } from "../types.ts";
import { BONUS_POINTS, CATEGORY_TITLES, SEVERITY_POINTS } from "../constants.ts";

export function pointsFor(check: Check, result: CheckResult): { earned: number; available: number } {
  const base = SEVERITY_POINTS[check.severity] ?? 0;

  if (check.severity === "emerging" || check.severity === "bonus") {
    if (result.status === "pass") return { earned: BONUS_POINTS, available: 0 };
    return { earned: 0, available: 0 };
  }

  if (result.status === "na") return { earned: 0, available: 0 };
  if (result.status === "pass") return { earned: base, available: base };
  if (result.status === "warning") return { earned: Math.round(base * 0.6), available: base };
  return { earned: 0, available: base };
}

export function scoreChecks(
  scored: ScoredCheck[],
): Scorecard {
  const categories = groupCategories(scored);
  const overallAvailable = categories.reduce((s, c) => s + c.available, 0);
  const overallEarned = categories.reduce((s, c) => s + c.earned, 0);
  const overall =
    overallAvailable === 0 ? null : Math.min(100, Math.round((overallEarned / overallAvailable) * 100));

  return {
    overall,
    categories,
    passed: scored.filter((s) => s.result.status === "pass").length,
    failed: scored.filter((s) => s.result.status === "fail").length,
    warnings: scored.filter((s) => s.result.status === "warning").length,
    na: scored.filter((s) => s.result.status === "na" || s.applicability.applicable === false).length,
    label: scoreLabel(overall),
  };
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "N/A";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Needs work";
}

function groupCategories(scored: ScoredCheck[]): CategoryScore[] {
  const order = [
    "discovery",
    "access",
    "understanding",
    "developer",
    "operation",
    "reliability",
    "security",
  ] as const;

  return order
    .map((id) => {
      const items = scored.filter((s) => s.check.category === id);
      if (items.length === 0) return undefined;
      const earned = items.reduce((s, i) => s + i.earned, 0);
      const available = items.reduce((s, i) => s + i.available, 0);
      const score = available === 0 ? null : Math.min(100, Math.round((earned / available) * 100));
      return {
        id,
        title: CATEGORY_TITLES[id] ?? id,
        score,
        earned,
        available,
        passed: items.filter((i) => i.result.status === "pass").length,
        failed: items.filter((i) => i.result.status === "fail").length,
        warnings: items.filter((i) => i.result.status === "warning").length,
        na: items.filter((i) => i.result.status === "na" || i.applicability.applicable === false).length,
      } satisfies CategoryScore;
    })
    .filter((c): c is CategoryScore => Boolean(c));
}

export async function runChecks(context: ScanContext, checks: Check[]): Promise<ScoredCheck[]> {
  const results: ScoredCheck[] = [];
  for (const check of checks) {
    const applicability = await check.applicability(context);
    if (!applicability.applicable) {
      const result: CheckResult = {
        status: "na",
        summary: applicability.reason,
        evidence: [],
      };
      results.push({ check, applicability, result, earned: 0, available: 0 });
      continue;
    }
    const result = await check.run(context);
    const { earned, available } = pointsFor(check, result);
    result.score = earned;
    result.maxScore = available || (check.severity === "emerging" || check.severity === "bonus" ? BONUS_POINTS : available);
    results.push({ check, applicability, result, earned, available });
  }
  return results;
}
