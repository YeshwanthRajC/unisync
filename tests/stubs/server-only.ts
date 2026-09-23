/**
 * No-op stand-in for the `server-only` package under Vitest.
 *
 * `server-only` throws on import unless the resolver picks its "react-server"
 * export condition. Node applies that condition only via a CLI flag, and Vitest
 * externalises CJS dependencies so `resolve.conditions` never reaches it. Aliasing
 * is the explicit fix: the guard exists to catch a Client Component importing
 * server code at build time, and a Node test runner is neither.
 */
export {};
