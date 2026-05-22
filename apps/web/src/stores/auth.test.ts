import { setActivePinia, createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, getAuthToken, setAuthToken } from "../api/auth";
import { useAuthStore } from "./auth";

describe("useAuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it("logs in and stores the bearer token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            token: "demo-token",
            user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
          }),
          { status: 200 }
        )
      )
    );
    const store = useAuthStore();

    await store.loginDemo();

    expect(store.user?.email).toBe("demo@hiveton.dev");
    expect(getAuthToken()).toBe("demo-token");
  });

  it("restores the current user from an existing token", async () => {
    setAuthToken("signed-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = useAuthStore();

    await store.restoreSession();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer signed-token" })
    }));
    expect(store.user?.displayName).toBe("Hiveton Demo");
  });

  it("clears token and user on logout", async () => {
    setAuthToken("signed-token");
    const store = useAuthStore();
    store.user = { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" };

    store.logout();

    expect(store.user).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it("surfaces login API error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "INVALID_CREDENTIALS", message: "invalid credentials" }
          }),
          { status: 401 }
        )
      )
    );
    const store = useAuthStore();

    await store.loginWithCredentials("demo@hiveton.dev", "wrong-password");

    expect(store.user).toBeNull();
    expect(store.error).toBe("invalid credentials");
  });
});
