// Storage read/modify/write operations must not overlap across messages and alarms.
let pending: Promise<unknown> = Promise.resolve();

export function enqueueTask<T>(task: () => Promise<T>): Promise<T> {
  const result = pending.then(task);
  pending = result.catch(() => undefined);
  return result;
}
