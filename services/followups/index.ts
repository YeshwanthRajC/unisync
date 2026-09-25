/**
 * Public surface of the follow-ups module. Other modules import from here only.
 */
export {
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  materializeDueStatuses,
} from "@/services/followups/commands";

export {
  listFollowUps,
  getFollowUpOrThrow,
  listFollowUpsForPatient,
  countOpenFollowUps,
  countOverdueFollowUps,
  FOLLOWUP_INCLUDE,
} from "@/services/followups/queries";

export {
  FOLLOWUP_STATUSES,
  FOLLOWUP_STATUS_LABELS,
  followUpFormSchema,
  followUpUpdateSchema,
  completeFollowUpSchema,
  cancelFollowUpSchema,
  followUpIdSchema,
  followUpListParamsSchema,
  type FollowUpStatus,
  type FollowUpFormInput,
  type FollowUpUpdateInput,
  type CompleteFollowUpInput,
  type CancelFollowUpInput,
  type FollowUpListParams,
} from "@/services/followups/schema";
