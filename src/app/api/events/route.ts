import { createClient } from "@/lib/supabase/server";
import { runEvent, type RunResult } from "@/lib/triggers/evaluate";

type IngestBody = {
  event_type?: unknown;
  payload?: unknown;
  idempotency_key?: unknown;
};

export async function POST(request: Request) {
  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const eventType =
    typeof body.event_type === "string" ? body.event_type.trim() : "";
  if (!eventType) {
    return jsonError(400, "Missing required field: event_type");
  }
  if (
    !body.payload ||
    typeof body.payload !== "object" ||
    Array.isArray(body.payload)
  ) {
    return jsonError(400, "Missing or invalid field: payload (object)");
  }
  const idempotencyKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim()
      : null;

  const supabase = await createClient();

  const { data: eventTypeRow, error: eventTypeError } = await supabase
    .from("event_types")
    .select("id")
    .eq("name", eventType)
    .maybeSingle();

  if (eventTypeError) {
    return jsonError(500, eventTypeError.message);
  }
  if (!eventTypeRow) {
    return jsonError(404, `Unknown event_type: ${eventType}`);
  }

  // Idempotency: if a row with this (event_type_id, idempotency_key) already
  // exists, short-circuit. Re-processing isn't safe without deleting prior sends.
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("event_type_id", eventTypeRow.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return Response.json({
        event_id: existing.id,
        idempotent_replay: true,
        runs: [] as RunResult[],
      });
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({
      event_type_id: eventTypeRow.id,
      payload: body.payload as never,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return jsonError(500, insertError?.message ?? "Failed to insert event");
  }

  try {
    const runs = await runEvent(supabase, inserted.id);
    return Response.json({
      event_id: inserted.id,
      idempotent_replay: false,
      runs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, message);
  }
}

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
