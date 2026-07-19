# Contributing

Keep changes small and reviewable. This repository is currently a focused 3D
viewer, not a graph extraction tool.

Before opening a review, run:

```bash
bun install
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

Use `bun.lock` as the only package lockfile. Do not commit local Graphify
exports, secrets, generated build output, or large new samples unless they are
intentionally part of a review.
