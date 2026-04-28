/** Multer field names for facilitator profile files (must match controller + profile service). */
export const FACILITATOR_PROFILE_DOCUMENT_KEYS = [
  'profile_image',
  'vendor_registration_form',
  'brief_profile_individual',
  'brief_profile_organization',
  'projects_handled',
  // Backward compatibility alias
  'biodata',
] as const;

/** Profile image is upload-required but excluded from approval-completion checks. */
export const FACILITATOR_REVIEW_REQUIRED_DOCUMENT_KEYS = [
  'vendor_registration_form',
  'brief_profile_individual',
  'brief_profile_organization',
  'projects_handled',
] as const;

export type FacilitatorProfileDocumentKey = (typeof FACILITATOR_PROFILE_DOCUMENT_KEYS)[number];
export type FacilitatorDocumentApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export function isFacilitatorProfileDocumentKey(
  key: string,
): key is FacilitatorProfileDocumentKey {
  return (FACILITATOR_PROFILE_DOCUMENT_KEYS as readonly string[]).includes(key);
}
