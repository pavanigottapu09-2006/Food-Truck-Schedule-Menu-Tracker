import { memStore, uid } from "@/lib/store";
import { getServerSupabase } from "@/lib/supabaseServer";
import type { Truck } from "@/lib/types";

export async function GET() {
  const sb = getServerSupabase();
  if (sb) {
    const { data, error } = await sb.from("trucks").select("*").order("created_at", { ascending: false });
    if (!error && data) return Response.json({ trucks: data as Truck[], source: "supabase" });
  }
  return Response.json({ trucks: memStore().trucks, source: "memory" });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Truck>;
  const sb = getServerSupabase();
  const row = {
    id: body.id || uid("t"),
    name: body.name || "New Truck",
    cuisine: body.cuisine || "Fusion",
    description: body.description || "",
    image_emoji: (body as unknown as { image_emoji?: string }).image_emoji || body.imageEmoji || "🚚",
    rating: body.rating ?? 4.5,
    price_level: (body as unknown as { price_level?: number }).price_level ?? body.priceLevel ?? 1,
    tags: body.tags ?? [],
    phone: body.phone ?? "",
    status: body.status || "prep",
    current_location: (body as unknown as { current_location?: string }).current_location || body.currentLocation || "Depot",
    next_location: (body as unknown as { next_location?: string }).next_location || body.nextLocation || "",
  };
  if (sb) {
    const { data, error } = await sb.from("trucks").insert(row).select().single();
    if (!error && data) return Response.json({ truck: data, source: "supabase" }, { status: 201 });
  }
  const truck: Truck = {
    id: row.id, name: row.name, cuisine: row.cuisine, description: row.description,
    imageEmoji: row.image_emoji, rating: row.rating, priceLevel: row.price_level as 1|2|3,
    tags: row.tags, phone: row.phone, status: row.status as Truck["status"],
    currentLocation: row.current_location, nextLocation: row.next_location,
    createdAt: new Date().toISOString(),
  };
  memStore().trucks.unshift(truck);
  return Response.json({ truck, source: "memory" }, { status: 201 });
}
