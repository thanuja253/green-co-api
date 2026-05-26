/** Quick View milestone labels (aligned with CompanyProjectFlow / getQuickviewData). */
export const MILESTONE_STEPS: Record<
  number,
  { name: string; responsibility: 'Company' | 'CII' | 'Assessor' | 'Facilitator' | 'Coordinator' }
> = {
  1: { name: 'Company Registered', responsibility: 'Company' },
  2: { name: 'Company Filled Registration Info', responsibility: 'Company' },
  3: { name: 'CII Uploaded Proposal Document', responsibility: 'CII' },
  4: { name: 'Company Uploaded Work Order Document', responsibility: 'Company' },
  5: { name: 'Work Order / Contract Document Accepted', responsibility: 'CII' },
  6: { name: 'CII to provide Project Code', responsibility: 'CII' },
  7: { name: 'Assign Project Co‑Ordinator', responsibility: 'CII' },
  8: { name: 'CII uploaded the PI/Tax Invoice', responsibility: 'CII' },
  9: { name: 'Company Paid Proforma Invoice', responsibility: 'Company' },
  10: { name: 'CII Acknowledged Proforma Invoice', responsibility: 'CII' },
  11: { name: 'Company Uploaded All Primary Data', responsibility: 'Company' },
  12: { name: 'CII Approved All Primary Data', responsibility: 'CII' },
  13: { name: 'All Checklist / Assessment Documents Uploaded by Company', responsibility: 'Company' },
  14: { name: 'CII Approved All Assessment Submittal', responsibility: 'CII' },
  15: { name: 'CII Assigned an Assessor', responsibility: 'CII' },
  16: { name: 'Preliminary Scoring submitted by CII', responsibility: 'CII' },
  17: { name: 'Final Scoring submitted (Rating Declaration)', responsibility: 'CII' },
  18: { name: 'Certificate Uploaded', responsibility: 'CII' },
  19: { name: '2nd Invoice uploaded', responsibility: 'CII' },
  20: { name: 'Payment Receipt of 2nd Invoice uploaded', responsibility: 'Company' },
  21: { name: 'Payment Receipt of 2nd Invoice acknowledged', responsibility: 'CII' },
  22: { name: 'Plaque & certificate dispatched', responsibility: 'CII' },
  23: { name: 'Feedback Report uploaded', responsibility: 'CII' },
  24: { name: 'Project close‑out / Sustenance phase', responsibility: 'Company' },
};

export type WorkflowEventType =
  | 'step_completed'
  | 'step_pending'
  | 'rejected'
  | 'reupload'
  | 'update';

export type WorkflowResponsibility =
  | 'Company'
  | 'CII'
  | 'Assessor'
  | 'Facilitator'
  | 'Coordinator';

export function milestoneActivity(
  flow: number,
  fallback?: string,
): { activity: string; responsibility: WorkflowResponsibility } {
  const step = MILESTONE_STEPS[flow];
  if (step) {
    return { activity: step.name, responsibility: step.responsibility };
  }
  return {
    activity: fallback || `Milestone ${flow}`,
    responsibility: 'CII',
  };
}
