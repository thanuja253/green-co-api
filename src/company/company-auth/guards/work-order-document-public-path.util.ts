/**
 * All `/work-order-document` routes (any method, any sub-path) are public — no JWT / account-status.
 */
export function isWorkOrderDocumentPublicApiPath(path: string): boolean {
  const p = String(path || '')
    .split('?')[0]
    .replace(/\/+$/, '');
  return /\/api\/company(?:\/projects|project|projects)\/[^/]+\/work-order-document(?:\/|$)/.test(
    p,
  );
}
