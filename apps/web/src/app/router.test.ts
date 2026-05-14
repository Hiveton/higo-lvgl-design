import { describe, expect, it } from "vitest";
import { routes } from "./router";

describe("router", () => {
  it("routes the first-release editor experience at the app root", () => {
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/",
          name: "editor"
        })
      ])
    );
  });

  it("redirects unknown routes back to the editor", () => {
    expect(routes).toContainEqual(
      expect.objectContaining({
        path: "/:pathMatch(.*)*",
        redirect: "/"
      })
    );
  });
});
