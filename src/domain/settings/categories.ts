import type { Category } from "./types";

export function orderedCategories(categories: readonly Category[]): Category[] {
  return [...categories];
}
