import { afterEach, describe, expect, it, vi } from "vitest";
import { authHeaders, clearAuthToken, getAuthToken, getCurrentUser, login, setAuthToken } from "./auth";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("auth api", () => {
  it("keeps auth token helpers usable when browser storage methods fail", () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem() {
          throw new Error("read blocked");
        },
        setItem() {
          throw new Error("write blocked");
        },
        removeItem() {
          throw new Error("remove blocked");
        }
      }
    });

    try {
      expect(() => setAuthToken("memory-token")).not.toThrow();
      expect(getAuthToken()).toBe("memory-token");
      expect(authHeaders()).toEqual({ Authorization: "Bearer memory-token" });
      expect(() => clearAuthToken()).not.toThrow();
      expect(getAuthToken()).toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      }
    }
  });

  it("logs in and stores the returned bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        token: "demo-token",
        user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("demo@hiveton.dev", "demo")).resolves.toMatchObject({
      token: "demo-token",
      user: { id: "user-demo" }
    });
    expect(getAuthToken()).toBe("demo-token");
  });

  it("normalizes returned bearer tokens before storing and using them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        token: "  demo-token  ",
        user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
      }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("demo@hiveton.dev", "demo")).resolves.toMatchObject({
      token: "demo-token",
      user: { id: "user-demo" }
    });
    expect(getAuthToken()).toBe("demo-token");
    expect(authHeaders()).toEqual({ Authorization: "Bearer demo-token" });
  });

  it("normalizes tokens read from storage or set directly", () => {
    localStorage.setItem("lvgl-editor-token", "  stored-token  ");

    expect(getAuthToken()).toBe("stored-token");
    expect(authHeaders()).toEqual({ Authorization: "Bearer stored-token" });

    setAuthToken("  memory-token  ");

    expect(getAuthToken()).toBe("memory-token");
    expect(localStorage.getItem("lvgl-editor-token")).toBe("memory-token");
    expect(authHeaders()).toEqual({ Authorization: "Bearer memory-token" });
  });

  it("rejects malformed successful login payloads without storing a token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "", user: null }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          token: "demo-token",
          user: { id: "user-demo", email: "not-an-email", displayName: "Hiveton Demo" }
        }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          token: "demo-token",
          user: { id: "", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
        }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          token: "demo-token",
          user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "" }
        }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(login("demo@hiveton.dev", "demo")).rejects.toMatchObject({
      code: "LOGIN_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();

    await expect(login("demo@hiveton.dev", "demo")).rejects.toMatchObject({
      code: "LOGIN_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();

    await expect(login("demo@hiveton.dev", "demo")).rejects.toMatchObject({
      code: "LOGIN_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();

    await expect(login("demo@hiveton.dev", "demo")).rejects.toMatchObject({
      code: "LOGIN_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();
  });

  it("rejects malformed successful current-user payloads and clears the stale token", async () => {
    setAuthToken("stale-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: null }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-demo", email: "not-an-email", displayName: "Hiveton Demo" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-demo", email: "demo@hiveton.dev", displayName: "" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUser()).rejects.toMatchObject({
      code: "CURRENT_USER_LOOKUP_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();

    setAuthToken("stale-token");
    await expect(getCurrentUser()).rejects.toMatchObject({
      code: "CURRENT_USER_LOOKUP_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();

    setAuthToken("stale-token");
    await expect(getCurrentUser()).rejects.toMatchObject({
      code: "CURRENT_USER_LOOKUP_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();

    setAuthToken("stale-token");
    await expect(getCurrentUser()).rejects.toMatchObject({
      code: "CURRENT_USER_LOOKUP_FAILED",
      status: 200
    });
    expect(getAuthToken()).toBeNull();
  });
});
