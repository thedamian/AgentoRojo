import { htmlToText } from "@agento-rojo/shared";
import type { ParentFeature, WorkItemComment, WorkItemDetails } from "@agento-rojo/shared";
import type { AdoClient, AdoRelation } from "../clients/ado.js";

const FIELD_TITLE = "System.Title";
const FIELD_DESCRIPTION = "System.Description";
const FIELD_ACCEPTANCE_CRITERIA = "Microsoft.VSTS.Common.AcceptanceCriteria";
const FIELD_WORK_ITEM_TYPE = "System.WorkItemType";
const FEATURE_TYPE = "Feature";
const REL_PARENT = "System.LinkTypes.Hierarchy-Reverse";

function fieldAsString(fields: Record<string, unknown>, key: string): string | undefined {
  const value = fields[key];
  return typeof value === "string" ? value : undefined;
}

function parentIdFromRelationUrl(url: string): number | null {
  const segments = url.split("/").filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1];
  if (!last || !/^\d+$/.test(last)) {
    return null;
  }
  return Number.parseInt(last, 10);
}

async function resolveParentFeature(
  adoClient: AdoClient,
  org: string,
  project: string,
  relations: AdoRelation[] | undefined,
): Promise<ParentFeature | null> {
  const parentRelation = (relations ?? []).find((relation) => relation.rel === REL_PARENT);
  if (!parentRelation) {
    return null;
  }

  const parentId = parentIdFromRelationUrl(parentRelation.url);
  if (parentId === null) {
    return null;
  }

  // A broken parent relation (deleted or inaccessible parent) degrades to
  // "no parent Feature" instead of failing the whole work item lookup.
  let parentWorkItem;
  try {
    parentWorkItem = await adoClient.getWorkItem(org, project, parentId);
  } catch {
    return null;
  }
  const parentFields = parentWorkItem.fields ?? {};
  const parentType = fieldAsString(parentFields, FIELD_WORK_ITEM_TYPE);
  if (parentType !== FEATURE_TYPE) {
    return null;
  }

  return {
    id: parentId,
    title: fieldAsString(parentFields, FIELD_TITLE) ?? "",
  };
}

/**
 * Orchestrates a full work item lookup: fetches the work item and its
 * comments, converts HTML fields to plain text, resolves the DoD field
 * (name configured in settings), and resolves the parent Feature (if any).
 */
export async function getWorkItemDetails(
  adoClient: AdoClient,
  org: string,
  project: string,
  id: number,
  dodFieldName: string,
  workItemUrl: string,
): Promise<WorkItemDetails> {
  const [workItem, rawComments] = await Promise.all([
    adoClient.getWorkItem(org, project, id),
    adoClient.getComments(org, project, id),
  ]);

  const fields = workItem.fields ?? {};

  const title = fieldAsString(fields, FIELD_TITLE) ?? "";
  const description = htmlToText(fieldAsString(fields, FIELD_DESCRIPTION));
  const acceptanceCriteria = htmlToText(fieldAsString(fields, FIELD_ACCEPTANCE_CRITERIA));
  const workItemType = fieldAsString(fields, FIELD_WORK_ITEM_TYPE) ?? "";

  const dodFieldMissing = !(dodFieldName in fields);
  const definitionOfDone = dodFieldMissing ? null : htmlToText(fieldAsString(fields, dodFieldName) ?? "");

  const comments: WorkItemComment[] = rawComments.map((comment) => ({
    id: comment.id,
    author: comment.createdBy?.displayName ?? "Unknown",
    createdDate: comment.createdDate,
    text: htmlToText(comment.text),
  }));

  const parentFeature = await resolveParentFeature(adoClient, org, project, workItem.relations);

  return {
    id,
    org,
    project,
    url: workItemUrl,
    title,
    description,
    acceptanceCriteria,
    definitionOfDone,
    dodFieldMissing,
    workItemType,
    comments,
    parentFeature,
  };
}
