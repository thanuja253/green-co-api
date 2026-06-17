/**
 * CII flow — Latest / Next display text only (matches Laravel CompanyProjectFlow PHP).
 * Keys are existing Nest milestone ids (1–24, 63). Does not change step/flow ids.
 */
export type QuickviewDisplayText = {
  latestText: string;
  latestResp: string;
  nextText: string | null;
  nextResp: string | null;
};

export const QUICKVIEW_DISPLAY_TEXT_BY_MILESTONE: Record<number, QuickviewDisplayText> = {
  1: {
    latestText: 'Company Registered',
    latestResp: 'Company',
    nextText: 'Fill Registration Info',
    nextResp: 'Company',
  },
  2: {
    latestText: 'Company Filled Registration Info',
    latestResp: 'Company',
    nextText: 'CII will Upload Proposal Document',
    nextResp: 'CII',
  },
  3: {
    latestText: 'CII Uploaded Proposal Document',
    latestResp: 'CII',
    nextText: 'Company Will Upload Work order',
    nextResp: 'Company',
  },
  4: {
    latestText: 'Company Uploaded Work Order Document',
    latestResp: 'Company',
    nextText: 'CII will Approved/Rejected Work Order',
    nextResp: 'CII',
  },
  5: {
    latestText: 'Work Order/ Contract Document Accepted',
    latestResp: 'CII',
    nextText: 'Upload Project Code',
    nextResp: 'CII',
  },
  6: {
    latestText: 'CII to provide Project Code',
    latestResp: 'CII',
    nextText: 'Assign Project Co-Ordinator',
    nextResp: 'CII',
  },
  7: {
    latestText: 'Assign Project Co-Ordinator',
    latestResp: 'CII',
    nextText: 'CII to upload the PI/Tax Invoice',
    nextResp: 'CII',
  },
  8: {
    latestText: 'CII to uploaded the PI/Tax Invoice',
    latestResp: 'CII',
    nextText: 'CII to upload the Site Visit report',
    nextResp: 'CII',
  },
  63: {
    latestText: 'CII to upload the Site Visit report',
    latestResp: 'CII',
    nextText: 'Company Will Make Payment',
    nextResp: 'Company',
  },
  9: {
    latestText: 'Company Paid Proforma Invoice',
    latestResp: 'Company',
    nextText: 'CII will Acknowlement Proforma Invoice',
    nextResp: 'CII',
  },
  10: {
    latestText: 'CII will Acknowlement Proforma Invoice',
    latestResp: 'CII',
    nextText: 'Need to Upload Primary Data Form',
    nextResp: 'Company',
  },
  11: {
    latestText: 'Company Uploaded All Primary Data',
    latestResp: 'Company',
    nextText: 'CII Need to Accpected Primary Data',
    nextResp: 'CII',
  },
  12: {
    latestText: 'CII Approved All Primary Data',
    latestResp: 'CII',
    nextText: 'All Assessment Submittals to be uploaded',
    nextResp: 'Company',
  },
  13: {
    latestText: 'All Checklist Documents Uploaded by Company',
    latestResp: 'Company',
    nextText: 'CII will Approved the All Checklist Documents',
    nextResp: 'CII',
  },
  14: {
    latestText: 'CII Approved All Assessment Submittal',
    latestResp: 'CII',
    nextText: 'CII Will Assign Assessor',
    nextResp: 'CII',
  },
  15: {
    latestText: 'CII Assigned an Assessor',
    latestResp: 'CII',
    nextText: 'Preliminary Scoring to be submitted by CII',
    nextResp: 'CII',
  },
  16: {
    latestText: 'Preliminary Scoring submitted by CII',
    latestResp: 'CII',
    nextText: 'Final Scoring is to be submitted(Rating Declaratio...',
    nextResp: 'Assessor',
  },
  17: {
    latestText: 'Final Scoring is submitted(Rating Declaration)',
    latestResp: 'Assessor',
    nextText: 'CII Will Upload Certificate',
    nextResp: 'CII',
  },
  18: {
    latestText: 'CII Uploaded Certificate',
    latestResp: 'CII',
    nextText: 'CII Will Raise 2nd Proforma Invoice',
    nextResp: 'CII',
  },
  19: {
    latestText: 'CII Uploaded 2nd Proforma Invoice',
    latestResp: 'CII',
    nextText: 'Company Will Make Payment',
    nextResp: 'Company',
  },
  20: {
    latestText: 'Company Paid 2nd Proforma Invoice',
    latestResp: 'Company',
    nextText: 'CII will Acknowlement 2nd Proforma Invoice ',
    nextResp: 'CII',
  },
  21: {
    latestText: 'CII Accpected 2nd Proforma Invoice Acknowlement',
    latestResp: 'CII',
    nextText: 'Plaque and PR Data should be Uploaded',
    nextResp: 'CII',
  },
  22: {
    latestText: 'CII dispatched Plaque & certificate',
    latestResp: 'CII',
    nextText: 'CII Will upload Feedback Report',
    nextResp: 'CII',
  },
  23: {
    latestText: 'CII Uploaded Feedback Report',
    latestResp: 'CII',
    nextText: null,
    nextResp: null,
  },
  24: {
    latestText: 'CII Uploaded Feedback Report',
    latestResp: 'CII',
    nextText: null,
    nextResp: null,
  },
};

export function getQuickviewDisplayText(milestoneFlowId: number): QuickviewDisplayText | null {
  if (!milestoneFlowId || milestoneFlowId < 1) {
    return QUICKVIEW_DISPLAY_TEXT_BY_MILESTONE[1] ?? null;
  }
  return QUICKVIEW_DISPLAY_TEXT_BY_MILESTONE[milestoneFlowId] ?? null;
}
