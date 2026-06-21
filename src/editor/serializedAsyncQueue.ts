export type SerializedAsyncQueue = {
  run: <T>(task: () => Promise<T>) => Promise<T>;
  drain: () => Promise<void>;
};

export function createSerializedAsyncQueue(): SerializedAsyncQueue {
  let tail = Promise.resolve();

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task, task);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
    drain(): Promise<void> {
      return tail;
    },
  };
}
