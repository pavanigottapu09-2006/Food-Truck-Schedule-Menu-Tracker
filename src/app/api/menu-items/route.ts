import { memStore, uid } from "@/lib/store";
import { getServerSupabase } from "@/lib/supabaseServer";

export async function GET() {
  const sb = getServerSupabase();
  if (sb) {
    const { data, error } = await sb.from("menu_items").select("*");
    if (!error && data) return Response.json({ items: data, source: "supabase" });
  }
  return Response.json({ items: memStore().menu, source: "memory" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const row = {
    id: body.id || uid("m"),
    truck_id: body.truckId || body.truck_id,
    name: body.name || "New Dish",
    description: body.description || "",
    price: Number(body.price ?? 8.99),
    category: body.category || "Mains",
    is_veg: body.isVeg ?? body.is_veg ?? false,
    is_spicy: body.isSpicy ?? body.is_spicy ?? false,
    is_special: body.isSpecial ?? body.is_special ?? false,
    available: body.available ?? true,
    calories: body.calories ?? null,
  };
  const sb = getServerSupabase();
  if (sb) {
    const { data, error } = await sb.from("menu_items").insert(row).select().single();
    if (!error && data) return Response.json({ item: data, source: "supabase" }, { status: 201 });
  }
  const item = {
    id: row.id, truckId: row.truck_id, name: row.name, description: row.description,
    price: row.price, category: row.category, isVeg: row.is_veg, isSpicy: row.is_spicy,
    isSpecial: row.is_special, available: row.available, calories: row.calories || undefined,
  };
  memStore().menu.push(item);
  return Response.json({ item, source: "memory" }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const sb = getServerSupabase();
  if (sb) await sb.from("menu_items").delete().eq("id", id);
  const store = memStore();
  store.menu = store.menu.filter((m) => m.id !== id);
  return Response.json({ ok: true });
}
