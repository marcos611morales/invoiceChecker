/**
 * Hard navigation seam. Full page load on purpose: it resets module memory and
 * the router cache. Tests mock this module because jsdom's location cannot be spied on.
 */
export function hardNavigate(path: string): void {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(path);
}
