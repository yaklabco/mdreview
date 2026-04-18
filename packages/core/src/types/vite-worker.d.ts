// Type declarations for Vite worker imports (`?worker` suffix).
// These modules are provided by the bundler at runtime; the constructor
// returns a standard `Worker` instance.

declare module '*?worker' {
  const WorkerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerConstructor;
}

declare module '*?worker&inline' {
  const WorkerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerConstructor;
}
