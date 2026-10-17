/**
 * Display order of the categories (UI-SPEC, D-02): Spanish alphabetical order with
 * accents and case ignored, and the suggested «Otros» last. «Otros» is identified by
 * its stable seed id, never by its current name, so renaming it does not move it.
 */
import { OTROS_ID, type Category } from "./types";

const COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

/** A new array; the input is not mutated. */
export function orderedCategories(categories: readonly Category[]): Category[] {
  const rest = categories
    .filter((category) => category.id !== OTROS_ID)
    .sort((a, b) => COLLATOR.compare(a.name, b.name));
  const otros = categories.filter((category) => category.id === OTROS_ID);
  return [...rest, ...otros];
}
