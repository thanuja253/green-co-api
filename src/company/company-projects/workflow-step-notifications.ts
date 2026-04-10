/**
 * In-app notification copy when a workflow milestone is marked complete.
 * Company actions → notify company (confirmation) + admin (visibility).
 * CII actions → notify company (FYI / next action).
 */

export type WorkflowActor = 'company' | 'cii';

export type MilestoneNotifyPayload = {
  company?: { title: string; content: string };
  admin?: { title: string; content: string };
};

/** Short label for the step that was completed (past tense). */
const STEP_COMPLETED_LABEL: Record<number, string> = {
  1: 'Company registered',
  2: 'Registration completed',
  3: 'Proposal document uploaded',
  4: 'Work order document uploaded',
  5: 'Work order / contract accepted',
  6: 'Project code provided',
  7: 'Project coordinator assigned',
  8: 'PI / Tax invoice uploaded',
  9: 'Proforma invoice paid',
  10: 'Proforma invoice acknowledged',
  11: 'Primary data uploaded',
  12: 'Primary data approved',
  13: 'Assessment documents uploaded',
  14: 'Assessment submittal approved',
  15: 'Assessor assigned',
  16: 'Preliminary scoring submitted',
  17: 'Final scoring / rating declaration submitted',
  18: 'Certificate uploaded',
  19: 'Second invoice uploaded',
  20: 'Second invoice payment receipt uploaded',
  21: 'Payment receipt acknowledged',
  22: 'Plaque & certificate dispatched',
  23: 'Feedback report uploaded',
  24: 'Project close-out / sustenance phase',
};

function stepLabel(flow: number): string {
  return STEP_COMPLETED_LABEL[flow] ?? `Milestone ${flow} completed`;
}

/**
 * Build payloads for NotificationsService.create(...)
 */
export function getMilestoneCompletionNotifications(
  milestoneFlow: number,
  actor: WorkflowActor,
  ctx: { companyName: string; projectLabel: string },
): MilestoneNotifyPayload {
  const { companyName, projectLabel } = ctx;
  const proj = projectLabel?.trim() || 'your project';
  const activity = stepLabel(milestoneFlow);

  if (actor === 'company') {
    return {
      company: {
        title: activity,
        content: `You completed this step for project ${proj}.`,
      },
      admin: {
        title: `${activity} by company`,
        content: `${companyName} — ${activity} (project ${proj}).`,
      },
    };
  }

  return {
    company: {
      title: activity,
      content: `${activity} by CII / GreenCo team for project ${proj}.`,
    },
  };
}
