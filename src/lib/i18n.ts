import messages from "@/messages/ko.json";

type Messages = typeof messages;

function getNestedValue(obj: Record<string, unknown>, keys: string[]): unknown {
  return keys.reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function t(key: string): string {
  const keys = key.split(".");
  const value = getNestedValue(messages as unknown as Record<string, unknown>, keys);
  if (typeof value === "string") return value;
  return key;
}

export type { Messages };
