import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

const testStorage = createMemoryStorage();

Object.defineProperty(globalThis, "Blob", {
  configurable: true,
  writable: true,
  value: NodeBlob
});

Object.defineProperty(globalThis, "File", {
  configurable: true,
  writable: true,
  value: NodeFile
});

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: testStorage
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "Blob", {
    configurable: true,
    writable: true,
    value: NodeBlob
  });

  Object.defineProperty(window, "File", {
    configurable: true,
    writable: true,
    value: NodeFile
  });

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: testStorage
  });
}

function createMemoryStorage(): Storage {
  let values: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(values).length;
    },
    clear() {
      values = {};
    },
    getItem(key: string) {
      return values[key] ?? null;
    },
    key(index: number) {
      return Object.keys(values)[index] ?? null;
    },
    removeItem(key: string) {
      delete values[key];
    },
    setItem(key: string, value: string) {
      values[key] = String(value);
    }
  };
}
