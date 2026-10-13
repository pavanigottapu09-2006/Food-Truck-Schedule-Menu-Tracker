import { memStore } from "@/lib/store";
import { getServerSupabase } from "@/lib/supabaseServer";

type Ctx = RouteContext<"/api/trucks/[id]">;

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json();
  const sb = getServerSupabase();
  if (sb) {
    const { data, error } = await sb.from("trucks").update(body).eq("id", id).select().single();
    if (!error && data) return Response.json({ truck: data, source: "supabase" });
  }
  const store = memStore();
  const i = store.trucks.findIndex((t) => t.id === id);
  if (i === -1) return Response.json({ error: "not found" }, { status: 404 });
  store.trucks[i] = { ...store.trucks[i], ...body };
  return Response.json({ truck: store.trucks[i], source: "memory" });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sb = getServerSupabase();
  if (sb) {
    const { error } = await sb.from("trucks").delete().eq("id", id);
    if (!error) return Response.json({ ok: true, source: "supabase" });
  }
  const store = memStore();
  store.trucks = store.trucks.filter((t) => t.id !== id);
  store.schedules = store.schedules.filter((s) => s.truckId !== id);
  store.menu = store.menu.filter((m) => m.truckId !== id);
  return Response.json({ ok: true, source: "memory" });
}
