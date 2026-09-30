process.env.KUCEDR_E2E_DATA_ROOT ??= `/tmp/kucedr-jest-${process.pid}`;
(globalThis as typeof globalThis & { __VITE_ENV__?: Record<string, unknown> }).__VITE_ENV__ ??= {};
