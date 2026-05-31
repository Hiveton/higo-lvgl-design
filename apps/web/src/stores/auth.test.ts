import { setActivePinia, createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, getAuthToken, setAuthToken } from "../api/auth";
import { useAuthStore } from "./auth";
import { useLocaleStore } from "./locale";

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
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

  it("does not restore a stale user after logout while restore is in flight", async () => {
    setAuthToken("signed-token");
    let resolveCurrentUser: (response: Response) => void = () => undefined;
    const currentUserResponse = new Promise<Response>((resolve) => {
      resolveCurrentUser = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(currentUserResponse));
    const store = useAuthStore();

    const restore = store.restoreSession();
    store.logout();
    resolveCurrentUser(new Response(
      JSON.stringify({ id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }),
      { status: 200 }
    ));
    await restore;

    expect(store.user).toBeNull();
    expect(store.error).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it("keeps the latest logged-in user when restore resolves after login", async () => {
    setAuthToken("signed-token");
    let resolveCurrentUser: (response: Response) => void = () => undefined;
    const currentUserResponse = new Promise<Response>((resolve) => {
      resolveCurrentUser = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/me") {
        return currentUserResponse;
      }
      if (url === "/api/auth/login") {
        return Promise.resolve(new Response(
          JSON.stringify({
            token: "fresh-token",
            user: { id: "user-fresh", email: "fresh@hiveton.dev", displayName: "Fresh User" }
          }),
          { status: 200 }
        ));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAuthStore();

    const restore = store.restoreSession();
    await store.loginWithCredentials("fresh@hiveton.dev", "password");
    resolveCurrentUser(new Response(
      JSON.stringify({ id: "user-old", email: "old@hiveton.dev", displayName: "Old User" }),
      { status: 200 }
    ));
    await restore;

    expect(store.user).toMatchObject({ id: "user-fresh", email: "fresh@hiveton.dev" });
    expect(store.error).toBeNull();
    expect(store.restoring).toBe(false);
    expect(getAuthToken()).toBe("fresh-token");
  });

  it("surfaces localized login API errors", async () => {
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
    expect(store.error).toBe("Invalid email or password");
  });

  it("surfaces login API errors in Chinese when the locale is Chinese", async () => {
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
    useLocaleStore().setLocale("zh-CN");
    const store = useAuthStore();

    await store.loginWithCredentials("demo@hiveton.dev", "wrong-password");

    expect(store.user).toBeNull();
    expect(store.error).toBe("邮箱或密码无效");
  });
});
