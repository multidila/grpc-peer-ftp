export * from "./types";
export * from "./integrity";
export * from "./proto";

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
