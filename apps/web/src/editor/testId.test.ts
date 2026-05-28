import { describe, expect, it } from "vitest";
import { toTestId } from "./testId";

describe("toTestId", () => {
  it("normalizes widget and screen names into stable test id segments", () => {
    expect(toTestId("Time_Label")).toBe("time-label");
    expect(toTestId("Heart Rate")).toBe("heart-rate");
    expect(toTestId("Screen (Main)/A")).toBe("screen-main-a");
  });
});
