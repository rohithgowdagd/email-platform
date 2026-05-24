// Trigger conditions: a small recursive JSON DSL evaluated against an event
// payload. Stored in `triggers.conditions` (typed as Json | null in the schema).
// `null` means "always fire".
//
// The form-based editor produces a subset of this DSL (a flat AND/OR of leaf
// conditions). Nested constructions require the JSON-mode editor.

export type LeafComparisonOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains";

export type ConditionNode =
  | { op: "and"; args: ConditionNode[] }
  | { op: "or"; args: ConditionNode[] }
  | { op: "not"; arg: ConditionNode }
  | { op: LeafComparisonOp; path: string; value: unknown }
  | { op: "in"; path: string; value: unknown[] }
  | { op: "exists"; path: string };

export function resolvePath(payload: unknown, expr: string): unknown {
  const normalized = expr.startsWith("$.") ? expr.slice(2) : expr;
  if (normalized === "" || normalized === "$") return payload;
  return normalized.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

export function evaluateConditions(
  node: ConditionNode | null,
  payload: unknown,
): boolean {
  if (node === null) return true;
  switch (node.op) {
    case "and":
      return node.args.every((n) => evaluateConditions(n, payload));
    case "or":
      return node.args.some((n) => evaluateConditions(n, payload));
    case "not":
      return !evaluateConditions(node.arg, payload);
    case "eq":
      return strictEq(resolvePath(payload, node.path), node.value);
    case "neq":
      return !strictEq(resolvePath(payload, node.path), node.value);
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return numCompare(node.op, resolvePath(payload, node.path), node.value);
    case "contains":
      return contains(resolvePath(payload, node.path), node.value);
    case "in":
      if (!Array.isArray(node.value)) return false;
      return node.value.some((v) =>
        strictEq(resolvePath(payload, node.path), v),
      );
    case "exists":
      return resolvePath(payload, node.path) !== undefined;
  }
}

// Best-effort parse: accept anything that looks roughly like our shape.
// The editor + the create/update server actions are the only writers, and
// they always produce well-formed JSON. We re-validate here defensively.
export function parseConditions(raw: unknown): ConditionNode | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  return raw as ConditionNode;
}

// Parse a value the user typed into a text input as a JSON literal, falling
// back to the raw string. Lets the editor accept `"pro"` (or just `pro`), `123`,
// `true`, `[1,2,3]` without making users think about quoting.
export function parseFormValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function strictEq(a: unknown, b: unknown): boolean {
  return a === b;
}

function numCompare(
  op: "gt" | "gte" | "lt" | "lte",
  a: unknown,
  b: unknown,
): boolean {
  if (typeof a !== "number" || typeof b !== "number") return false;
  switch (op) {
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
  }
}

function contains(haystack: unknown, needle: unknown): boolean {
  if (typeof haystack === "string" && typeof needle === "string") {
    return haystack.includes(needle);
  }
  if (Array.isArray(haystack)) {
    return haystack.some((v) => v === needle);
  }
  return false;
}
