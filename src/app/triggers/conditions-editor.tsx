"use client";

import { useEffect, useMemo, useState } from "react";

import {
  parseFormValue,
  type ConditionNode,
  type LeafComparisonOp,
} from "@/lib/triggers/conditions";

type RowOp = LeafComparisonOp | "in" | "exists";

type Row = {
  id: string;
  path: string;
  op: RowOp;
  value: string;
};

const ALL_OPS: { value: RowOp; label: string; takesValue: boolean }[] = [
  { value: "eq", label: "equals", takesValue: true },
  { value: "neq", label: "not equals", takesValue: true },
  { value: "gt", label: ">", takesValue: true },
  { value: "gte", label: ">=", takesValue: true },
  { value: "lt", label: "<", takesValue: true },
  { value: "lte", label: "<=", takesValue: true },
  { value: "contains", label: "contains", takesValue: true },
  { value: "in", label: "in (array)", takesValue: true },
  { value: "exists", label: "exists", takesValue: false },
];

export function ConditionsEditor({
  initialJson,
}: {
  initialJson: string;
}) {
  const initial = useMemo(() => parseInitial(initialJson), [initialJson]);
  const [mode, setMode] = useState<"form" | "json">(initial.mode);
  const [topOp, setTopOp] = useState<"and" | "or">(initial.topOp);
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [jsonText, setJsonText] = useState(initial.jsonText);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const conditionsJson = useMemo(() => {
    if (mode === "form") return serializeForm(topOp, rows);
    return jsonText.trim();
  }, [mode, topOp, rows, jsonText]);

  // Sync json textarea when form changes so switching modes is lossless.
  useEffect(() => {
    if (mode === "form") {
      const pretty = prettyJson(conditionsJson);
      if (pretty !== jsonText) setJsonText(pretty);
    }
  }, [mode, conditionsJson, jsonText]);

  function switchMode(next: "form" | "json") {
    setSwitchError(null);
    if (next === mode) return;
    if (next === "form") {
      const parsed = tryParseToForm(jsonText);
      if (!parsed.ok) {
        setSwitchError(
          `Can't represent this in form mode: ${parsed.error}. Keep editing as JSON.`,
        );
        return;
      }
      setTopOp(parsed.topOp);
      setRows(parsed.rows);
    } else {
      setJsonText(prettyJson(serializeForm(topOp, rows)));
    }
    setMode(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="conditions" value={conditionsJson} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => switchMode("form")}
            className={`px-2.5 py-1 rounded-full border transition-colors ${
              mode === "form"
                ? "bg-foreground text-background border-foreground"
                : "border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4"
            }`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => switchMode("json")}
            className={`px-2.5 py-1 rounded-full border transition-colors ${
              mode === "json"
                ? "bg-foreground text-background border-foreground"
                : "border-black/12 dark:border-white/18 hover:bg-black/4 dark:hover:bg-white/4"
            }`}
          >
            JSON (advanced)
          </button>
        </div>
      </div>

      {switchError && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {switchError}
        </p>
      )}

      {mode === "form" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Match when
            </span>
            <select
              value={topOp}
              onChange={(e) => setTopOp(e.target.value as "and" | "or")}
              className="h-8 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-2 text-sm"
            >
              <option value="and">all conditions are true (AND)</option>
              <option value="or">any condition is true (OR)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {rows.length === 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500 italic">
                No conditions. Trigger fires on every matching event.
              </p>
            )}
            {rows.map((row, i) => {
              const op = ALL_OPS.find((o) => o.value === row.op);
              const takesValue = op?.takesValue ?? true;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="text"
                    value={row.path}
                    onChange={(e) =>
                      updateRow(setRows, i, { path: e.target.value })
                    }
                    placeholder="user.email"
                    className="h-9 flex-1 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-2.5 text-sm font-mono"
                  />
                  <select
                    value={row.op}
                    onChange={(e) =>
                      updateRow(setRows, i, { op: e.target.value as RowOp })
                    }
                    className="h-9 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-2 text-sm"
                  >
                    {ALL_OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) =>
                      updateRow(setRows, i, { value: e.target.value })
                    }
                    placeholder={
                      row.op === "in" ? `["pro","team"]` : `"pro"`
                    }
                    disabled={!takesValue}
                    className="h-9 flex-1 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-2.5 text-sm font-mono disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-black/12 dark:border-white/18 text-zinc-600 dark:text-zinc-400 hover:bg-black/4 dark:hover:bg-white/4"
                    aria-label="Remove condition"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div>
            <button
              type="button"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), path: "", op: "eq", value: "" },
                ])
              }
              className="text-sm text-zinc-700 dark:text-zinc-300 hover:underline"
            >
              + Add condition
            </button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Path is dot-notation against the event payload (e.g.{" "}
            <code>user.email</code> or <code>$.user.email</code>). Value is
            parsed as JSON when possible — type <code>123</code> for a number,{" "}
            <code>true</code> for boolean, or plain text for a string.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={10}
            spellCheck={false}
            className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
            placeholder={`{"op":"and","args":[{"op":"eq","path":"plan","value":"pro"}]}`}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Empty / <code>null</code> means &quot;always fire&quot;. Supports
            nested <code>and</code>/<code>or</code>/<code>not</code> and leaf
            ops (eq, neq, gt, gte, lt, lte, contains, in, exists).
          </p>
        </div>
      )}
    </div>
  );
}

function updateRow(
  setRows: React.Dispatch<React.SetStateAction<Row[]>>,
  index: number,
  patch: Partial<Row>,
) {
  setRows((prev) =>
    prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
  );
}

function serializeForm(topOp: "and" | "or", rows: Row[]): string {
  const args: ConditionNode[] = [];
  for (const row of rows) {
    const path = row.path.trim();
    if (!path) continue;
    if (row.op === "exists") {
      args.push({ op: "exists", path });
    } else if (row.op === "in") {
      const parsed = parseFormValue(row.value);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      args.push({ op: "in", path, value: arr });
    } else {
      args.push({
        op: row.op,
        path,
        value: parseFormValue(row.value),
      });
    }
  }
  if (args.length === 0) return "";
  if (args.length === 1) return JSON.stringify(args[0]);
  return JSON.stringify({ op: topOp, args });
}

function tryParseToForm(
  jsonText: string,
):
  | { ok: true; topOp: "and" | "or"; rows: Row[] }
  | { ok: false; error: string } {
  const trimmed = jsonText.trim();
  if (trimmed === "" || trimmed === "null") {
    return { ok: true, topOp: "and", rows: [] };
  }
  let node: unknown;
  try {
    node = JSON.parse(trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `invalid JSON (${message})` };
  }

  if (!node || typeof node !== "object") {
    return { ok: false, error: "not an object" };
  }

  const root = node as { op?: string; args?: unknown; arg?: unknown };
  // Single leaf: wrap as a one-row AND.
  if (isLeafShape(root)) {
    const row = leafToRow(root as Record<string, unknown>);
    if (!row) return { ok: false, error: "unknown leaf op" };
    return { ok: true, topOp: "and", rows: [row] };
  }
  if (root.op !== "and" && root.op !== "or") {
    return { ok: false, error: `top-level op '${root.op}' not supported` };
  }
  if (!Array.isArray(root.args)) {
    return { ok: false, error: "args is not an array" };
  }

  const rows: Row[] = [];
  for (const child of root.args) {
    if (!child || typeof child !== "object") {
      return { ok: false, error: "non-object child" };
    }
    if (!isLeafShape(child as { op?: string })) {
      return { ok: false, error: "nested non-leaf child" };
    }
    const row = leafToRow(child as Record<string, unknown>);
    if (!row) return { ok: false, error: "unknown leaf op" };
    rows.push(row);
  }

  return { ok: true, topOp: root.op, rows };
}

function isLeafShape(node: { op?: string }): boolean {
  return (
    typeof node.op === "string" &&
    ALL_OPS.some((o) => o.value === (node.op as RowOp))
  );
}

function leafToRow(node: Record<string, unknown>): Row | null {
  const op = node.op as RowOp;
  const path = typeof node.path === "string" ? node.path : "";
  let value = "";
  if (op === "exists") {
    value = "";
  } else if (op === "in") {
    value = JSON.stringify(node.value ?? []);
  } else {
    value =
      typeof node.value === "string"
        ? JSON.stringify(node.value)
        : JSON.stringify(node.value ?? null);
  }
  return { id: crypto.randomUUID(), path, op, value };
}

function parseInitial(initialJson: string): {
  mode: "form" | "json";
  topOp: "and" | "or";
  rows: Row[];
  jsonText: string;
} {
  const result = tryParseToForm(initialJson);
  if (result.ok) {
    return {
      mode: "form",
      topOp: result.topOp,
      rows: result.rows,
      jsonText: prettyJson(initialJson),
    };
  }
  return {
    mode: "json",
    topOp: "and",
    rows: [],
    jsonText: prettyJson(initialJson),
  };
}

function prettyJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return raw;
  }
}
