/**
 * Milestone cards aligned with legacy PHP workflow (current / next / responsibility per step).
 * Keys are the completed milestone id the card describes (what is done → what comes next).
 */

export type WorkflowMilestoneCard = {
  current_activity: string;
  current_activity_id: string;
  current_responsibility: string;
  next_activity: string;
  next_activity_id: string;
  next_responsibility: string;
  current_next_activity?: string;
  previous_activity?: string;
  previous_activity_id?: string;
  previous_responsibility?: string;
  previous_current_activity?: string;
  sub_activities?: unknown[];
};

/** Steps 1–6: exact labels from product spec */
export const WORKFLOW_MILESTONE_CARDS_CORE: Record<number, WorkflowMilestoneCard> = {
  1: {
    current_activity: 'Company Registered',
    current_activity_id: '1',
    current_responsibility: 'Company',
    next_activity: 'Fill Registration Info',
    next_activity_id: '2',
    next_responsibility: 'Company',
  },
  2: {
    current_activity: 'Company Filled Registration Info',
    current_next_activity: 'Fill Registration Info',
    current_activity_id: '2',
    current_responsibility: 'Company',
    next_activity: 'CII will Upload Proposal Document',
    next_activity_id: '3',
    next_responsibility: 'CII',
    previous_activity: '',
    previous_activity_id: '',
    previous_responsibility: '',
  },
  3: {
    current_activity: 'CII Uploaded Proposal Document',
    current_next_activity: 'CII will Upload Proposal Document',
    current_activity_id: '3',
    current_responsibility: 'CII',
    next_activity: 'Company Will Upload Work order',
    next_activity_id: '4',
    next_responsibility: 'Company',
  },
  4: {
    current_activity: 'Company Uploaded Work Order Document',
    current_next_activity: 'Company Will Upload Work order',
    current_activity_id: '4',
    current_responsibility: 'Company',
    next_activity: 'CII will Approved/Rejected Work Order',
    next_activity_id: '5',
    next_responsibility: 'CII',
  },
  5: {
    current_activity: 'Work Order/ Contract Document Accepted',
    current_next_activity: 'CII will Approved/Rejected Work Order',
    current_activity_id: '5',
    current_responsibility: 'CII',
    next_activity: 'Upload Project Code',
    next_activity_id: '6',
    next_responsibility: 'CII',
    previous_current_activity: 'Work Order/ Contract Document Rejected',
    previous_activity: 'Company Will Upload Work order',
    previous_activity_id: '4',
    previous_responsibility: 'Company',
  },
  6: {
    current_activity: 'CII to provide Project Code',
    current_next_activity: 'Upload Project Code',
    current_activity_id: '6',
    current_responsibility: 'CII',
    next_activity: 'Assign Project Co-Ordinator',
    // Legacy PHP used "61"; backend flow uses milestone 7.
    next_activity_id: '7',
    next_responsibility: 'CII',
    sub_activities: [],
  },
};

export type MilestoneStepDef = { name: string; responsibility: string };

/**
 * Build cards for milestones 7–24 from canonical step names (same as DB / activity logs).
 */
export function extendWorkflowCardsFromMilestoneSteps(
  milestoneSteps: Record<number, MilestoneStepDef>,
): Record<number, WorkflowMilestoneCard> {
  const out: Record<number, WorkflowMilestoneCard> = {
    ...WORKFLOW_MILESTONE_CARDS_CORE,
  };
  for (let n = 7; n <= 24; n++) {
    const cur = milestoneSteps[n];
    const nxt = milestoneSteps[n + 1];
    if (!cur) continue;
    out[n] = {
      current_activity: cur.name,
      current_activity_id: String(n),
      current_responsibility: cur.responsibility,
      next_activity: nxt?.name ?? 'Project Completed',
      next_activity_id: String(n < 24 ? n + 1 : 24),
      next_responsibility: nxt?.responsibility ?? '',
    };
  }
  return out;
}

/** Next-step labels when moving toward milestone `nextMilestoneNumber` (1–24). */
export function resolveNextStepFromCards(
  nextMilestoneNumber: number,
  latestCompletedMilestoneNumber: number,
  milestoneSteps: Record<number, MilestoneStepDef>,
  fullCards: Record<number, WorkflowMilestoneCard>,
): { name: string; responsibility: string } {
  if (nextMilestoneNumber <= 0) {
    return { name: 'Project Completed', responsibility: 'N/A' };
  }
  if (nextMilestoneNumber === 1 && latestCompletedMilestoneNumber === 0) {
    const s = milestoneSteps[1];
    return { name: s?.name ?? 'Company Registered', responsibility: s?.responsibility ?? 'Company' };
  }
  const card = fullCards[nextMilestoneNumber - 1];
  if (card?.next_activity) {
    return {
      name: card.next_activity,
      responsibility: card.next_responsibility || 'N/A',
    };
  }
  const step = milestoneSteps[nextMilestoneNumber];
  return {
    name: step?.name ?? 'Project Completed',
    responsibility: step?.responsibility ?? 'N/A',
  };
}

/** Latest completed step labels for quick view / timeline. */
export function resolveLatestStepFromCards(
  latestCompletedMilestoneNumber: number,
  milestoneSteps: Record<number, MilestoneStepDef>,
  fullCards: Record<number, WorkflowMilestoneCard>,
): { name: string; responsibility: string } {
  if (latestCompletedMilestoneNumber <= 0) {
    return { name: 'No activity yet', responsibility: 'Company' };
  }
  const card = fullCards[latestCompletedMilestoneNumber];
  if (card?.current_activity) {
    return {
      name: card.current_activity,
      responsibility: card.current_responsibility || 'N/A',
    };
  }
  const step = milestoneSteps[latestCompletedMilestoneNumber];
  return {
    name: step?.name ?? 'No activity yet',
    responsibility: step?.responsibility ?? 'Company',
  };
}
