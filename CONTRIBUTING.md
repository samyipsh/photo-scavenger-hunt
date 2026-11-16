# Contributing

Changes are welcome. Most of this code was written by AI coding agents, and `AGENTS.md` is the working guide for anyone, person or agent: where things are, the rules that must hold, and the checks to run.

Before opening a pull request:

1. `pnpm verify` (typecheck and unit tests) passes.
2. For server changes, `pnpm check:api` passes against `pnpm dev`.
3. For screen changes, attach screenshots of the screens that changed, at phone width.
4. `docs/architecture.md` still describes what the code does.

Keep event-specific content in `data/`, UI copy short and plain, and text at least 16 px with tap targets at least 44 px.
