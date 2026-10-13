export type TruckStatus = "open" | "closed" | "prep" | "on-break" | "offline";

export interface Truck {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  imageEmoji: string;
  rating: number;
  priceLevel: 1 | 2 | 3;
  tags: string[];
  phone?: string;
  status: TruckStatus;
  currentLocation: string;
  nextLocation?: string;
  createdAt: string;
}

export interface ScheduleEntry {
  id: string;
  truckId: string;
  day: string; // e.g. "Monday"
  date?: string; // YYYY-MM-DD for specific overrides
  startTime: string; // "10:00"
  endTime: string; // "14:00"
  location: string;
  address: string;
  notes?: string;
  status: TruckStatus;
}

export interface MenuItem {
  id: string;
  truckId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isVeg: boolean;
  isSpicy: boolean;
  isSpecial: boolean;
  available: boolean;
  calories?: number;
}

export interface DashboardStats {
  totalTrucks: number;
  openNow: number;
  todayStops: number;
  menuItems: number;
  avgRating: number;
}
