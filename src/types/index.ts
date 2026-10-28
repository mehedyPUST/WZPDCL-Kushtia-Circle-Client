export interface Feeder {
  id: number;
  name: string;
  bus: 1 | 2;
}

export interface CalculationResult {
  id?: string;
  _id?: string;
  date: string;
  time: string;
  hourSlot?: string;
  bus1Voltage: number;
  bus2Voltage: number;
  feeders: Record<string, number>;
  totalMW: number;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "user";
}

export interface Settings {
  stationName?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
