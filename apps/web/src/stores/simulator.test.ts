import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useSimulatorStore } from "./simulator";

describe("useSimulatorStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("tracks simulator load, render, ready and failed states", () => {
    const store = useSimulatorStore();

    store.markLoading();
    expect(store.status).toBe("loading");
    expect(store.message).toBe("Loading runtime");

    store.markReady();
    expect(store.status).toBe("ready");
    expect(store.message).toBe("Simulator loaded");

    store.markRendering("Screen_1");
    expect(store.status).toBe("rendering");
    expect(store.message).toBe("Rendering Screen_1");

    store.markFailed("Missing asset: icon.png");
    expect(store.status).toBe("failed");
    expect(store.lastError).toBe("Missing asset: icon.png");
  });

  it("clears the previous error after loading or rendering resumes", () => {
    const store = useSimulatorStore();

    store.markFailed("Runtime load failed");
    store.markRendering("Screen_2");

    expect(store.status).toBe("rendering");
    expect(store.lastError).toBeNull();

    store.markFailed("Preview failed");
    store.markLoading("Retrying runtime");
    expect(store.message).toBe("Retrying runtime");
    expect(store.lastError).toBeNull();
  });
});
