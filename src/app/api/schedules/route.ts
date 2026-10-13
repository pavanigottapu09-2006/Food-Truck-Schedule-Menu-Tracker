import { memStore, uid } from "@/lib/store";
import { getServerSupabase } from "@/lib/supabaseServer";

export async function GET() {
  const sb = getServerSupabase();
  if (sb) {
    const { data, error } = await sb.from("schedules").select("*").order("day");
    if (!error && data) return Response.json({ schedules: data, source: "supabase" });
  }
  return Response.json({ schedules: memStore().schedules, source: "memory" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = {
    id: body.id || uid("s"),
    truck_id: body.truckId || body.truck_id,
    day: body.day || "Monday",
    date: body.date || null,
    start_time: body.startTime || body.start_time || "11:00",
    end_time: body.endTime || body.end_time || "15:00",
    location: body.location || "Downtown",
    address: body.address || "",
    notes: body.notes || "",
    status: body.status || "open",
  };
  const sb = getServerSupabase();
  if (sb) {
    const { data, error } = await sb.from("schedules").insert(row).select().single();
    if (!error && data) return Response.json({ schedule: data, source: "supabase" }, { status: 201 });
  }
  const entry = {
    id: row.id, truckId: row.truck_id, day: row.day, date: row.date || undefined,
    startTime: row.start_time, endTime: row.end_time, location: row.location,
    address: row.address, notes: row.notes, status: row.status,
  };
  memStore().schedules.push(entry);
  return Response.json({ schedule: entry, source: "memory" }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const sb = getServerSupabase();
  if (sb) await sb.from("schedules").delete().eq("id", id);
  const store = memStore();
  store.schedules = store.schedules.filter((s) => s.id !== id);
  return Response.json({ ok: true });
}
