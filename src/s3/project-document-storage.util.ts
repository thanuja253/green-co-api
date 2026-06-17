/**
 * Shared helpers for proposal / work-order PDF storage keys and viewer URLs.
 */

export function pickS3KeyFromBody(body?: Record<string, unknown> | null): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidates = [
    body.proposal_document_s3_key,
    body.work_order_s3_key,
    body.s3_key,
    body.file_s3_key,
    body.document_s3_key,
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return null;
}

/** Launch & Training session uploads (presigned S3 flow). */
export function pickLaunchTrainingS3KeyFromBody(
  body?: Record<string, unknown> | null,
): string | null {
  if (!body || typeof body !== 'object') return null;
  const candidates = [
    body.launch_session_file_s3_key,
    body.launch_training_document_s3_key,
    body.launch_and_training_document_s3_key,
    body.document_s3_key,
    body.file_s3_key,
    body.s3_key,
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return null;
}

export function buildWorkOrderDocumentViewUrl(
  projectId: string,
  cacheBust?: number | string | null,
): { document_url: string; document_cache_bust: string } {
  const path = `/api/company/projects/${projectId}/work-order-document/file`;
  const document_cache_bust = String(
    Math.round(Number(cacheBust ?? Date.now())),
  );
  return {
    document_url: `${path}?v=${encodeURIComponent(document_cache_bust)}`,
    document_cache_bust,
  };
}
