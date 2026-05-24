"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { setByPath } from "@/lib/templates/render";

type Row = {
  id: string;
  key: string;
  value: string;
};

export function PayloadEditor({
  eventTypeSelectName,
  fieldsByEventType,
  initialEventTypeId,
}: {
  // Name of the <select> element in the same form whose value indicates the
  // current event type. We listen for changes and reset the rows to that
  // event type's default fields.
  eventTypeSelectName: string;
  fieldsByEventType: Record<string, string[]>;
  initialEventTypeId: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    seedRows(fieldsByEventType[initialEventTypeId] ?? []),
  );

  // When the user picks a different event type, swap in that type's defaults
  // (we'd be showing irrelevant fields otherwise — better to start fresh).
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = formRef.current;
    if (!root) return;
    const form = root.closest("form");
    if (!form) return;
    const select = form.elements.namedItem(eventTypeSelectName);
    if (!(select instanceof HTMLSelectElement)) return;
    const handle = () => {
      setRows(seedRows(fieldsByEventType[select.value] ?? []));
    };
    select.addEventListener("change", handle);
    return () => select.removeEventListener("change", handle);
  }, [eventTypeSelectName, fieldsByEventType]);

  const payloadJson = useMemo(() => {
    const obj: Record<string, unknown> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (!key) continue;
      setByPath(obj, key, row.value);
    }
    return JSON.stringify(obj);
  }, [rows]);

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function add() {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: "", value: "" },
    ]);
  }

  return (
    <div ref={formRef} className="flex flex-col gap-3">
      <input type="hidden" name="payload" value={payloadJson} />

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-500 italic">
          No fields yet. Click &quot;Add field&quot; to start building the
          payload.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={row.id} className="flex items-center gap-2 text-sm">
              <input
                type="text"
                value={row.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="user.name"
                className="h-9 flex-1 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-2.5 text-sm font-mono outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              />
              <span className="text-zinc-400">=</span>
              <input
                type="text"
                value={row.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Alex"
                className="h-9 flex-1 rounded-md border border-black/12 dark:border-white/18 bg-transparent px-2.5 text-sm outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-black/12 dark:border-white/18 text-zinc-600 dark:text-zinc-400 hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
                aria-label="Remove field"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={add}
          className="text-sm text-zinc-700 dark:text-zinc-300 hover:underline"
        >
          + Add field
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Field name uses dot-notation for nested fields. E.g. typing{" "}
        <code className="font-mono">user.name</code> creates a nested{" "}
        <code className="font-mono">user</code> object with a{" "}
        <code className="font-mono">name</code> field inside.
      </p>
    </div>
  );
}

function seedRows(fields: string[]): Row[] {
  const unique = Array.from(new Set(fields));
  if (unique.length === 0) {
    return [{ id: crypto.randomUUID(), key: "", value: "" }];
  }
  return unique.map((key) => ({
    id: crypto.randomUUID(),
    key,
    value: "",
  }));
}
