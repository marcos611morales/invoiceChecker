/**
 * The sensitive-pattern guard (UI-SPEC OQ7, LLM-03, T-04-40, WR-04). Shared by the browser builders
 * (`candidates.ts`) and the request schemas of the LLM routes (`contract.ts`), so it must stay free
 * of imports: either side can load it without pulling the other one in.
 *
 * Vendor text can carry identifiers typed by the issuer; the request schemas only stop fields, not
 * what a description says. So every text that would leave the browser is checked, and what matches
 * is kept out of every body (browser) or refused (server).
 */

/** An RFC: 3 or 4 letters (Ñ and & included), 6 digits (the date) and 3 letters or digits. */
const RFC_PATTERN = /(?<![\p{L}\d])[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}(?![\p{L}\d])/iu;
/** A UUID, 8-4-4-4-12 hexadecimal. */
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** An e-mail address. */
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/i;
/** A long number: 8 or more consecutive digits. */
const LONG_NUMBER_PATTERN = /\d{8,}/;

/**
 * True when `text` has something shaped like an RFC, a UUID, an e-mail address or a run of 8 or
 * more digits. It errs on the side of withholding: a product code that happens to look like an RFC
 * is kept in the browser and listed in the dialog, never sent. The patterns carry no `g` flag, so
 * they hold no state between calls.
 */
export function isSensitive(text: string): boolean {
  return (
    RFC_PATTERN.test(text) ||
    UUID_PATTERN.test(text) ||
    LONG_NUMBER_PATTERN.test(text) ||
    // The `@` check first keeps the e-mail pattern from scanning long texts that cannot match.
    (text.includes("@") && EMAIL_PATTERN.test(text))
  );
}
