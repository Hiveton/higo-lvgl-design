export function createEditorUUID(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) => {
    const random = Math.trunc(Math.random() * 16);
    const value = Number(character) ^ (random & (15 >> (Number(character) / 4)));
    return value.toString(16);
  });
}
