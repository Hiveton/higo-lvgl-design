import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditorShell from "./EditorShell.vue";

const runtimeMocks = vi.hoisted(() => ({
  loadRuntime: vi.fn()
}));

vi.mock("@hiveton-lvgl/lvgl-wasm-runtime", () => ({
  loadRuntime: runtimeMocks.loadRuntime,
  SimulatorRuntimeError: class SimulatorRuntimeError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
}));

afterEach(() => {
  runtimeMocks.loadRuntime.mockReset();
});

describe("EditorShell simulator lifecycle", () => {
  it("ignores a stale simulator runtime load after the simulator is hidden", async () => {
    let resolveRuntime: (runtime: {
      mount: ReturnType<typeof vi.fn>;
      renderProject: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      getRuntimeKind: () => string;
    }) => void = () => undefined;
    const runtimePromise = new Promise<{
      mount: ReturnType<typeof vi.fn>;
      renderProject: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
      getRuntimeKind: () => string;
    }>((resolve) => {
      resolveRuntime = resolve;
    });
    runtimeMocks.loadRuntime.mockReturnValue(runtimePromise);
    const runtime = {
      mount: vi.fn(async () => undefined),
      renderProject: vi.fn(async () => undefined),
      destroy: vi.fn(),
      getRuntimeKind: () => "mock-runtime"
    };
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await flushPromises();
    expect(runtimeMocks.loadRuntime).toHaveBeenCalled();

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="simulator-canvas"]').exists()).toBe(false);

    resolveRuntime(runtime);
    await flushPromises();

    expect(runtime.mount).not.toHaveBeenCalled();
    expect(runtime.renderProject).not.toHaveBeenCalled();
    expect(runtime.destroy).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("ignores a stale simulator runtime load failure after the simulator is hidden", async () => {
    let rejectRuntime: (error: Error) => void = () => undefined;
    const runtimePromise = new Promise<never>((_resolve, reject) => {
      rejectRuntime = reject;
    });
    runtimeMocks.loadRuntime.mockReturnValue(runtimePromise);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await flushPromises();
    expect(runtimeMocks.loadRuntime).toHaveBeenCalled();

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="simulator-canvas"]').exists()).toBe(false);

    rejectRuntime(new Error("runtime network failed"));
    await flushPromises();

    expect(wrapper.text()).not.toContain("runtime network failed");
    expect(wrapper.text()).not.toContain("Runtime load failed");

    wrapper.unmount();
  });

  it("ignores a stale simulator render after the simulator is hidden", async () => {
    let resolveRender: () => void = () => undefined;
    const renderPromise = new Promise<void>((resolve) => {
      resolveRender = resolve;
    });
    const runtime = {
      mount: vi.fn(async () => undefined),
      renderProject: vi.fn(() => renderPromise),
      destroy: vi.fn(),
      getRuntimeKind: () => "mock-runtime"
    };
    runtimeMocks.loadRuntime.mockResolvedValue(runtime);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await flushPromises();
    expect(runtime.renderProject).toHaveBeenCalled();

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="simulator-canvas"]').exists()).toBe(false);

    resolveRender();
    await flushPromises();

    expect(wrapper.text()).not.toContain("Preview updated");
    expect(runtime.destroy).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it("ignores a stale simulator render failure after the simulator is hidden", async () => {
    let rejectRender: (error: Error) => void = () => undefined;
    const renderPromise = new Promise<never>((_resolve, reject) => {
      rejectRender = reject;
    });
    const runtime = {
      mount: vi.fn(async () => undefined),
      renderProject: vi.fn(() => renderPromise),
      destroy: vi.fn(),
      getRuntimeKind: () => "mock-runtime"
    };
    runtimeMocks.loadRuntime.mockResolvedValue(runtime);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await flushPromises();
    expect(runtime.renderProject).toHaveBeenCalled();

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();

    rejectRender(new Error("render failed after hide"));
    await flushPromises();

    expect(wrapper.text()).not.toContain("render failed after hide");
    expect(wrapper.text()).not.toContain("Preview failed");
    expect(runtime.destroy).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
