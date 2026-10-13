"use client";

import { useEffect, useMemo, useState } from "react";
import { seedMenu, seedSchedules, seedTrucks } from "@/lib/seed";
import type { MenuItem, ScheduleEntry, Truck, TruckStatus } from "@/lib/types";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const STATUS_META: Record<TruckStatus, { label: string; dot: string; pill: string }> = {
  open: { label: "Open now", dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  prep: { label: "Prepping", dot: "bg-amber-500", pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  "on-break": { label: "On break", dot: "bg-orange-500", pill: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  closed: { label: "Closed", dot: "bg-zinc-400", pill: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  offline: { label: "Offline", dot: "bg-red-500", pill: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
};

const LS_KEY = "ftt-state-v1";

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function DashboardClient() {
  const [trucks, setTrucks] = useState<Truck[]>(() => {
    if (typeof window === "undefined") return seedTrucks;
    const local = loadLocal();
    return (local?.trucks as Truck[]) ?? seedTrucks;
  });
  const [schedules, setSchedules] = useState<ScheduleEntry[]>(() => {
    if (typeof window === "undefined") return seedSchedules;
    const local = loadLocal();
    return (local?.schedules as ScheduleEntry[]) ?? seedSchedules;
  });
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    if (typeof window === "undefined") return seedMenu;
    const local = loadLocal();
    return (local?.menu as MenuItem[]) ?? seedMenu;
  });
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [tab, setTab] = useState<"overview" | "schedule" | "menu" | "ai" | "reports">("overview");
  const [selectedTruck, setSelectedTruck] = useState<string>(seedTrucks[0].id);
  const [now, setNow] = useState<Date | null>(() =>
    typeof window === "undefined" ? null : new Date()
  );
  const [live, setLive] = useState(true);
  const [source, setSource] = useState<"seed" | "local" | "api" | "supabase">(() =>
    typeof window === "undefined" ? "seed" : loadLocal() ? "local" : "seed"
  );
  const [aiTask, setAiTask] = useState("menu-description");
  const [aiInput, setAiInput] = useState({ name: "Baja Fish Taco", cuisine: "Mexican", ingredients: "cod, chipotle crema, slaw", price: "4.50" });
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // form state
  const [newTruck, setNewTruck] = useState({ name: "", cuisine: "", location: "" });
  const [newDish, setNewDish] = useState({ name: "", price: "", category: "Mains" });

  // realtime clock tick (state updates only in interval callback)
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [live]);

  // hydrate from API + subscribe to Supabase realtime (callbacks only)
  useEffect(() => {
    fetch("/api/trucks").then((r) => r.json()).then((d) => {
      if (d?.trucks?.length) { setTrucks(d.trucks.map(normalizeTruck)); setSource(d.source === "supabase" ? "supabase" : "api"); }
    }).catch(() => {});
    fetch("/api/schedules").then((r) => r.json()).then((d) => {
      if (d?.schedules?.length) setSchedules(d.schedules.map(normalizeSchedule));
    }).catch(() => {});
    fetch("/api/menu-items").then((r) => r.json()).then((d) => {
      if (d?.items?.length) setMenu(d.items.map(normalizeMenu));
    }).catch(() => {});

    if (isSupabaseConfigured) {
      const sb = getBrowserSupabase();
      const ch = sb?.channel("ftt-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "trucks" }, (p) => {
          if (p.eventType === "INSERT") setTrucks((t) => [normalizeTruck(p.new), ...t]);
          if (p.eventType === "UPDATE") setTrucks((t) => t.map((x) => (x.id === (p.new as {id:string}).id ? normalizeTruck(p.new) : x)));
          if (p.eventType === "DELETE") setTrucks((t) => t.filter((x) => x.id !== (p.old as {id:string}).id));
        }).subscribe();
      return () => { ch?.unsubscribe(); };
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ trucks, schedules, menu })); } catch { /* ignore */ }
  }, [trucks, schedules, menu]);

  const cuisines = useMemo(() => ["All", ...Array.from(new Set(trucks.map((t) => t.cuisine)))], [trucks]);

  const filtered = useMemo(() => trucks.filter((t) => {
    const q = query.toLowerCase();
    const matchQ = !q || [t.name, t.cuisine, t.currentLocation, ...(t.tags || [])].join(" ").toLowerCase().includes(q);
    const matchC = cuisine === "All" || t.cuisine === cuisine;
    const matchS = statusFilter === "All" || t.status === statusFilter;
    return matchQ && matchC && matchS;
  }), [trucks, query, cuisine, statusFilter]);

  const stats = useMemo(() => ({
    total: trucks.length,
    open: trucks.filter((t) => t.status === "open").length,
    stops: schedules.length,
    dishes: menu.length,
    avg: trucks.length ? (trucks.reduce((a, t) => a + t.rating, 0) / trucks.length).toFixed(1) : "—",
  }), [trucks, schedules, menu]);

  const truckMenu = useMemo(() => menu.filter((m) => m.truckId === selectedTruck), [menu, selectedTruck]);

  async function cycleStatus(id: string) {
    const order: TruckStatus[] = ["open", "prep", "on-break", "closed", "offline"];
    const cur = trucks.find((t) => t.id === id)?.status || "closed";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setTrucks((ts) => ts.map((t) => (t.id === id ? { ...t, status: next } : t)));
    try {
      await fetch(`/api/trucks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    } catch { /* offline ok */ }
  }

  async function addTruck() {
    if (!newTruck.name.trim()) return;
    const payload = { name: newTruck.name, cuisine: newTruck.cuisine || "Fusion", currentLocation: newTruck.location || "Depot", status: "prep" as TruckStatus, rating: 4.5, priceLevel: 1 as const, tags: [], description: "New truck — edit me.", imageEmoji: "🚚" };
    const optimistic: Truck = { ...payload, id: `t_${Date.now()}`, nextLocation: "", createdAt: new Date().toISOString() };
    setTrucks((t) => [optimistic, ...t]);
    setNewTruck({ name: "", cuisine: "", location: "" });
    try {
      const r = await fetch("/api/trucks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d?.truck?.id) setTrucks((t) => t.map((x) => (x.id === optimistic.id ? normalizeTruck(d.truck) : x)));
    } catch { /* keep optimistic */ }
  }

  async function addDish() {
    if (!newDish.name.trim()) return;
    const payload = { truckId: selectedTruck, name: newDish.name, price: Number(newDish.price) || 8.99, category: newDish.category, description: "Fresh & tasty.", isVeg: false, isSpicy: false, isSpecial: false, available: true };
    const optimistic: MenuItem = { ...payload, id: `m_${Date.now()}` };
    setMenu((m) => [...m, optimistic]);
    setNewDish({ name: "", price: "", category: "Mains" });
    try {
      const r = await fetch("/api/menu-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (d?.item?.id) setMenu((m) => m.map((x) => (x.id === optimistic.id ? normalizeMenu(d.item) : x)));
    } catch { /* keep optimistic */ }
  }

  async function runAI() {
    setAiLoading(true);
    try {
      const r = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: aiTask, input: aiInput }) });
      const d = await r.json();
      setAiOut(d.text + (d.source === "local" ? "\n\n— generated offline (set OPENAI_API_KEY for LLM mode)" : "\n\n— generated by LLM"));
    } catch {
      setAiOut("AI unavailable. Try again.");
    } finally { setAiLoading(false); }
  }

  function exportCSV(kind: "trucks" | "schedule" | "menu") {
    const data = kind === "trucks" ? trucks : kind === "schedule" ? schedules : menu;
    const blob = new Blob([toCSV(data as unknown as Record<string, unknown>[])], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `food-truck-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-2xl">🚚</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">Food Truck Schedule &amp; Menu Tracker</h1>
            <p className="text-xs text-zinc-500">{now ? now.toLocaleString() : "loading…"} · {live ? "● live" : "○ paused"} · source: {source}{isSupabaseConfigured ? " · supabase realtime on" : " · supabase not configured (local mode)"}</p>
          </div>
          <nav className="ml-auto flex flex-wrap gap-1">
            {(["overview", "schedule", "menu", "ai", "reports"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${tab === t ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-200 dark:hover:bg-zinc-800"}`}>{t}</button>
            ))}
          </nav>
          <button onClick={() => setLive((v) => !v)} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{live ? "Pause live" : "Resume live"}</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { k: "Trucks", v: stats.total },
            { k: "Open now", v: stats.open },
            { k: "Stops", v: stats.stops },
            { k: "Dishes", v: stats.dishes },
            { k: "Avg rating", v: `★ ${stats.avg}` },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-2xl font-bold">{s.v}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">{s.k}</div>
            </div>
          ))}
        </section>

        {tab === "overview" && (
          <>
            {/* filters */}
            <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trucks, cuisines, locations…"
                className="min-w-52 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700" />
              <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                {cuisines.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                {["All", "open", "prep", "on-break", "closed", "offline"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="ml-auto flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                {(["cards", "table"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 text-sm capitalize ${view === v ? "bg-white shadow dark:bg-zinc-900" : "text-zinc-500"}`}>{v}</button>
                ))}
              </div>
            </section>

            {/* add truck */}
            <section className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
              <input value={newTruck.name} onChange={(e) => setNewTruck({ ...newTruck, name: e.target.value })} placeholder="New truck name"
                className="min-w-40 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
              <input value={newTruck.cuisine} onChange={(e) => setNewTruck({ ...newTruck, cuisine: e.target.value })} placeholder="Cuisine"
                className="w-36 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
              <input value={newTruck.location} onChange={(e) => setNewTruck({ ...newTruck, location: e.target.value })} placeholder="Location"
                className="w-40 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
              <button onClick={addTruck} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">+ Add truck</button>
            </section>

            {view === "cards" ? (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((t) => (
                  <article key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start gap-3">
                      <span className="text-4xl">{t.imageEmoji}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold">{t.name}</h3>
                        <p className="text-xs text-zinc-500">{t.cuisine} · {"$".repeat(t.priceLevel)} · ★ {t.rating}</p>
                        <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[t.status].pill}`}>
                          <span className={`h-2 w-2 rounded-full ${STATUS_META[t.status].dot} ${live && t.status === "open" ? "animate-pulse" : ""}`} />{STATUS_META[t.status].label}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{t.description}</p>
                    <p className="mt-2 text-sm">📍 <b>{t.currentLocation}</b>{t.nextLocation ? <span className="text-zinc-500"> → {t.nextLocation}</span> : null}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{(t.tags || []).map((tag) => <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">#{tag}</span>)}</div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => cycleStatus(t.id)} className="flex-1 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">Update status</button>
                      <button onClick={() => { setSelectedTruck(t.id); setTab("menu"); }} className="flex-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-zinc-900">Menu &amp; schedule</button>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                    <tr><th className="px-4 py-3">Truck</th><th className="px-4 py-3">Cuisine</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Rating</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                        <td className="px-4 py-2 font-semibold">{t.imageEmoji} {t.name}</td>
                        <td className="px-4 py-2">{t.cuisine}</td>
                        <td className="px-4 py-2">{t.currentLocation}</td>
                        <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[t.status].pill}`}>{STATUS_META[t.status].label}</span></td>
                        <td className="px-4 py-2">★ {t.rating}</td>
                        <td className="px-4 py-2"><button onClick={() => cycleStatus(t.id)} className="rounded-lg border px-2 py-1 text-xs">Cycle status</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        {tab === "schedule" && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                {trucks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={() => exportCSV("schedule")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Export CSV</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {schedules.filter((s) => !selectedTruck || s.truckId === selectedTruck).map((s) => (
                <div key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <b>{s.day} · {s.startTime}–{s.endTime}</b>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[s.status]?.pill || ""}`}>{s.status}</span>
                  </div>
                  <p className="mt-1 text-sm">📍 {s.location} — <span className="text-zinc-500">{s.address}</span></p>
                  {s.notes ? <p className="mt-1 text-xs text-zinc-500">📝 {s.notes}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500">Truck: {trucks.find((t) => t.id === s.truckId)?.name}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "menu" && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select value={selectedTruck} onChange={(e) => setSelectedTruck(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                {trucks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input value={newDish.name} onChange={(e) => setNewDish({ ...newDish, name: e.target.value })} placeholder="Dish name" className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
              <input value={newDish.price} onChange={(e) => setNewDish({ ...newDish, price: e.target.value })} placeholder="$" className="w-24 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
              <button onClick={addDish} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">+ Add dish</button>
              <button onClick={() => exportCSV("menu")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Export CSV</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {truckMenu.map((m) => (
                <div key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-2">
                    <div><b>{m.name}</b> {m.isSpecial ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">special</span> : null}
                      <p className="text-xs text-zinc-500">{m.category} · ${m.price.toFixed(2)}</p></div>
                    <button onClick={() => setMenu((mm) => mm.map((x) => (x.id === m.id ? { ...x, available: !x.available } : x)))}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.available ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"}`}>{m.available ? "available" : "sold out"}</button>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{m.description}</p>
                  <div className="mt-1 flex gap-1 text-xs">{m.isVeg ? <span>🥬 veg</span> : null}{m.isSpicy ? <span>🌶 spicy</span> : null}</div>
                </div>
              ))}
              {truckMenu.length === 0 ? <p className="text-sm text-zinc-500">No dishes yet — add one above or use AI to generate.</p> : null}
            </div>
          </section>
        )}

        {tab === "ai" && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold">✨ AI Copilot</h2>
              <p className="text-xs text-zinc-500">Auto-generate descriptions, specials, schedule tips &amp; promos. Works offline; connects to an LLM when configured.</p>
              <label className="mt-3 block text-xs font-semibold">TASK</label>
              <select value={aiTask} onChange={(e) => setAiTask(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                <option value="menu-description">Menu description</option>
                <option value="daily-special">Daily special</option>
                <option value="schedule-optimizer">Schedule optimizer</option>
                <option value="marketing-blurb">Marketing blurb</option>
              </select>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(aiInput).map(([k, v]) => (
                  <label key={k} className="text-xs font-semibold capitalize">{k}
                    <input value={v} onChange={(e) => setAiInput({ ...aiInput, [k]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-zinc-700" />
                  </label>
                ))}
              </div>
              <button onClick={runAI} disabled={aiLoading} className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">
                {aiLoading ? "Generating…" : "Generate"}
              </button>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold">Output</h2>
              <p className="mt-2 min-h-32 whitespace-pre-wrap text-sm">{aiOut || "Run the generator to see smart suggestions here."}</p>
              {aiOut ? <button onClick={() => { navigator.clipboard?.writeText(aiOut); }} className="mt-3 rounded-xl border px-3 py-1.5 text-xs font-semibold">Copy</button> : null}
            </div>
          </section>
        )}

        {tab === "reports" && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-bold">📊 Export &amp; reporting</h2>
            <p className="text-sm text-zinc-500">Download CSV snapshots or print a daily operations report.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => exportCSV("trucks")} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">Trucks CSV</button>
              <button onClick={() => exportCSV("schedule")} className="rounded-xl border px-4 py-2 text-sm font-semibold">Schedule CSV</button>
              <button onClick={() => exportCSV("menu")} className="rounded-xl border px-4 py-2 text-sm font-semibold">Menu CSV</button>
              <button onClick={() => window.print()} className="rounded-xl border px-4 py-2 text-sm font-semibold">🖨 Print report</button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-zinc-500"><tr><th className="py-2">Truck</th><th>Stops</th><th>Dishes</th><th>Avail %</th><th>Status</th></tr></thead>
                <tbody>
                  {trucks.map((t) => {
                    const stops = schedules.filter((s) => s.truckId === t.id).length;
                    const dishes = menu.filter((m) => m.truckId === t.id);
                    const avail = dishes.length ? Math.round((dishes.filter((d) => d.available).length / dishes.length) * 100) : 0;
                    return <tr key={t.id} className="border-b last:border-0"><td className="py-2 font-semibold">{t.name}</td><td>{stops}</td><td>{dishes.length}</td><td>{avail}%</td><td>{t.status}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Next.js + Tailwind · API routes · Supabase-ready · AI copilot · Vercel-ready — Food Truck Tracker
      </footer>
    </div>
  );
}

function normalizeTruck(r: Record<string, unknown>): Truck {
  return {
    id: String(r.id),
    name: String(r.name ?? "Truck"),
    cuisine: String(r.cuisine ?? "Fusion"),
    description: String(r.description ?? ""),
    imageEmoji: String(r.image_emoji ?? r.imageEmoji ?? "🚚"),
    rating: Number(r.rating ?? 4.5),
    priceLevel: (Number(r.price_level ?? r.priceLevel ?? 1) as 1 | 2 | 3) || 1,
    tags: (r.tags as string[]) || [],
    phone: String(r.phone ?? ""),
    status: (r.status as TruckStatus) || "prep",
    currentLocation: String(r.current_location ?? r.currentLocation ?? "Depot"),
    nextLocation: String(r.next_location ?? r.nextLocation ?? ""),
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}

function normalizeSchedule(r: Record<string, unknown>): ScheduleEntry {
  return {
    id: String(r.id), truckId: String(r.truck_id ?? r.truckId), day: String(r.day ?? "Monday"),
    date: (r.date as string) || undefined, startTime: String(r.start_time ?? r.startTime ?? "11:00"),
    endTime: String(r.end_time ?? r.endTime ?? "15:00"), location: String(r.location ?? ""),
    address: String(r.address ?? ""), notes: String(r.notes ?? ""), status: (r.status as TruckStatus) || "open",
  };
}

function normalizeMenu(r: Record<string, unknown>): MenuItem {
  return {
    id: String(r.id), truckId: String(r.truck_id ?? r.truckId), name: String(r.name ?? "Dish"),
    description: String(r.description ?? ""), price: Number(r.price ?? 0), category: String(r.category ?? "Mains"),
    isVeg: Boolean(r.is_veg ?? r.isVeg), isSpicy: Boolean(r.is_spicy ?? r.isSpicy),
    isSpecial: Boolean(r.is_special ?? r.isSpecial), available: r.available !== false,
    calories: (r.calories as number) || undefined,
  };
}
