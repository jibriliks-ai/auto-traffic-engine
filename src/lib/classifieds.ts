import { readFileSync } from "fs";
import { join } from "path";

export type ClassifiedSite = {
  name: string;
  url: string;
  category: string;
  da: number;
};

let cached: Record<string, ClassifiedSite[]> | null = null;

export function loadClassifieds(): Record<string, ClassifiedSite[]> {
  if (cached) return cached;
  try {
    const filePath = join(process.cwd(), "src", "data", "classifieds.json");
    const raw = readFileSync(filePath, "utf-8");
    cached = JSON.parse(raw);
    return cached!;
  } catch (e) {
    console.error("[classifieds] failed to load:", e);
    return {};
  }
}

export function getCountries(): string[] {
  return Object.keys(loadClassifieds()).sort();
}

export function getSitesForCountry(country: string): ClassifiedSite[] {
  const data = loadClassifieds();
  return data[country] ?? [];
}