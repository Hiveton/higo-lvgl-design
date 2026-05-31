import { describe, expect, it } from "vitest";
import { apiError, apiErrorFromPayload } from "./errors";

describe("api errors", () => {
  it("falls back when an error response body does not match the ErrorBody contract", async () => {
    const error = await apiError(
      new Response(JSON.stringify({ error: { code: 123, message: { text: "nope" } } }), { status: 500 }),
      "PROJECT_LIST_FAILED",
      "project list failed with status 500"
    );

    expect(error).toMatchObject({
      code: "PROJECT_LIST_FAILED",
      detail: "project list failed with status 500",
      message: "project list failed with status 500",
      status: 500
    });
  });

  it("falls back when a parsed error payload does not match the ErrorBody contract", () => {
    const error = apiErrorFromPayload(
      new Response(null, { status: 200 }),
      { error: { code: 123, message: { text: "nope" } } } as never,
      "JOB_LOOKUP_FAILED",
      "job lookup failed with status 200"
    );

    expect(error).toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      detail: "job lookup failed with status 200",
      message: "job lookup failed with status 200",
      status: 200
    });
  });

  it("falls back when an error response body has empty error strings", async () => {
    const error = await apiError(
      new Response(JSON.stringify({ error: { code: "", message: "   " } }), { status: 500 }),
      "PROJECT_LIST_FAILED",
      "project list failed with status 500"
    );

    expect(error).toMatchObject({
      code: "PROJECT_LIST_FAILED",
      detail: "project list failed with status 500",
      message: "project list failed with status 500",
      status: 500
    });
  });

  it("falls back when a parsed error payload has empty error strings", () => {
    const error = apiErrorFromPayload(
      new Response(null, { status: 200 }),
      { error: { code: "   ", message: "" } },
      "JOB_LOOKUP_FAILED",
      "job lookup failed with status 200"
    );

    expect(error).toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      detail: "job lookup failed with status 200",
      message: "job lookup failed with status 200",
      status: 200
    });
  });
});
