/**
 * All `/proposal-document` routes (any method, any sub-path) are public — no JWT / account-status.
 * Matches controller bases: `api/company/projects`, `api/companyproject`, `api/companyprojects`.
 */
export function isProposalDocumentPublicApiPath(path: string): boolean {
  const p = String(path || '')
    .split('?')[0]
    .replace(/\/+$/, '');
  return /\/api\/company(?:\/projects|project|projects)\/[^/]+\/proposal-document(?:\/|$)/.test(
    p,
  );
}
