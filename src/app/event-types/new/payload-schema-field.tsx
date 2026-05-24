"use client";

import { useState } from "react";

const EXAMPLE = `{
  "type": "object",
  "required": ["user"],
  "properties": {
    "user": {
      "type": "object",
      "required": ["id", "email"],
      "properties": {
        "id":    { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "name":  { "type": "string" }
      }
    },
    "plan": { "type": "string", "enum": ["pro", "team", "enterprise"] }
  }
}`;

export function PayloadSchemaField({
  defaultValue = "",
}: {
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Payload schema{" "}
          <span className="text-xs text-zinc-500 dark:text-zinc-500 font-normal">
            (optional — leave blank to skip)
          </span>
        </span>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setValue(EXAMPLE)}
            className="text-zinc-700 dark:text-zinc-300 hover:underline"
          >
            Use example
          </button>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="text-zinc-600 dark:text-zinc-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <textarea
        name="payload_schema"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        spellCheck={false}
        placeholder={EXAMPLE}
        className="rounded-md border border-black/12 dark:border-white/18 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:border-zinc-900 dark:focus:border-zinc-100 resize-y"
      />
      <span className="text-xs text-zinc-500 dark:text-zinc-500">
        Optional JSON Schema describing the expected payload. Used to prefill
        the &quot;Fire test event&quot; form on /events. Skip this field
        entirely if you don&apos;t need a schema.
      </span>
    </div>
  );
}
