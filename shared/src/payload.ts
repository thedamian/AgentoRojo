import { MAX_PAYLOAD_BYTES } from "./constants.js";
import type { DispatchPayload } from "./types.js";

function byteSizeOf(payload: DispatchPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

/**
 * If the JSON-serialized payload exceeds MAX_PAYLOAD_BYTES (measured in UTF-8
 * bytes), drops comments oldest-first until it fits, setting
 * `commentsTruncated: true`. If it still exceeds the cap with zero comments
 * remaining, returns it anyway (never throws). Pure: never mutates the input.
 */
export function truncateDispatchPayload(payload: DispatchPayload): DispatchPayload {
  if (byteSizeOf(payload) <= MAX_PAYLOAD_BYTES) {
    return { ...payload, comments: [...payload.comments] };
  }

  let comments = [...payload.comments];
  let candidate: DispatchPayload = { ...payload, comments, commentsTruncated: true };

  while (comments.length > 0 && byteSizeOf(candidate) > MAX_PAYLOAD_BYTES) {
    comments = comments.slice(1);
    candidate = { ...payload, comments, commentsTruncated: true };
  }

  return candidate;
}
