/** Multer field names for assessor profile files (must match controller + profile service). */
export const ASSESSOR_PROFILE_DOCUMENT_KEYS = [
  'profile_image',
  'biodata',
  'vendor_registration_form',
  'non_disclosure_agreement',
  'health_declaration',
  'gst_declaration',
  'pan_card',
  'cancelled_cheque',
] as const;

/** Profile image is upload-required but excluded from approval-completion checks. */
export const ASSESSOR_REVIEW_REQUIRED_DOCUMENT_KEYS = [
  'biodata',
  'vendor_registration_form',
  'non_disclosure_agreement',
  'health_declaration',
  'gst_declaration',
  'pan_card',
  'cancelled_cheque',
] as const;

export type AssessorProfileDocumentKey = (typeof ASSESSOR_PROFILE_DOCUMENT_KEYS)[number];

export type AssessorDocumentApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export function isAssessorProfileDocumentKey(key: string): key is AssessorProfileDocumentKey {
  return (ASSESSOR_PROFILE_DOCUMENT_KEYS as readonly string[]).includes(key);
}
