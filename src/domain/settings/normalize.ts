/**
 * Key of a concept rule (D-09, D-10, D-26). The rule is stored under the supplier
 * RFC plus the normalized description of the line.
 *
 * Deliberately different from `normalizeSearch` in the lib layer (which the domain
 * may not import): that helper strips every combining mark, so «ñ» becomes «n» and
 * «PEÑA» would share a key with «PENA», two different words. Here «ñ» is a letter
 * of its own and is kept; only the other marks (acute, dieresis, ...) are removed.
 */

const NTILDE = "ñ";

/**
 * Lowercase, accent-insensitive (except «ñ»), whitespace collapsed and trimmed.
 * «Café  Molido 1kg» and «CAFE MOLIDO 1KG» give "cafe molido 1kg"; «CAFE 1KG» and
 * «CAFE 500G» stay apart; «PEÑA» gives "peña", not "pena".
 */
export function normalizeDescription(text: string): string {
  // NFC first so a decomposed n plus U+0303 becomes «ñ» before it is protected.
  const composed = text.normalize("NFC").toLowerCase();
  return composed
    .split(NTILDE)
    .map((segment) => segment.normalize("NFD").replace(/\p{M}/gu, ""))
    .join(NTILDE)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Key of the in-memory rule Map. The two parts are joined with NUL, which cannot
 * appear in XML text, so no pair of (rfc, key) can collide with another (Pitfall 8).
 */
export function ruleMapKey(rfc: string, key: string): string {
  return `${rfc}\u0000${key}`;
}
