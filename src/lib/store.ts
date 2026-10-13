import type { MenuItem, ScheduleEntry, Truck } from "./types";
import { seedMenu, seedSchedules, seedTrucks } from "./seed";

// Simple in-memory fallback store for API routes when Supabase is not configured.
// NOTE: resets on server restart / serverless cold start — Supabase is the durable layer.
const g = globalThis as unknown as {
  __ftt?: { trucks: Truck[]; schedules: ScheduleEntry[]; menu: MenuItem[] };
};

if (!g.__ftt) {
  g.__ftt = {
    trucks: [...seedTrucks],
    schedules: [...seedSchedules],
    menu: [...seedMenu],
  };
}

export function memStore() {
  return g.__ftt!;
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
