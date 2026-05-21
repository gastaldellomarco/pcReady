Lighthouse Budgets

This document explains the progressive Lighthouse budget strategy used by CI.

**Phases**

- **phase1**: realistic, anti-regression budgets (default). Use to avoid noisy failures while still catching regressions.
- **phase2**: intermediate targets to aim for after first set of optimizations.
- **phase3**: final target budgets aligned with UX/Web Vitals recommendations.

Budget files in repo:

- `lighthouse-budget-phase1.json` — default stage used by CI
- `lighthouse-budget-phase2.json` — intermediate
- `lighthouse-budget-phase3.json` — target
- `lighthouse-budget.json` — legacy single-file (kept for compatibility)

How CI selects budgets

- The Lighthouse workflow reads the repo variable `LHCI_BUDGET_STAGE` (or `BUDGET_STAGE` env) to choose the budget file. Valid values: `phase1`, `phase2`, `phase3`.
- Default is `phase1` to avoid blocking on long-running optimizations.

Promoting budgets

- When a set of optimizations is merged and validated, update the repository variable `LHCI_BUDGET_STAGE` to `phase2` (or `phase3`) via GitHub repo settings or CI/CD config.

Acceptance strategy

- Start with `phase1` to catch regressions only.
- Use `phase2` as a milestone after measurable improvements (bundle size, code-splitting, image optimization).
- Move to `phase3` when budgets are reliably met across a few runs.

Notes

- To run analysis locally and view bundle composition, use `ANALYZE=true bun run build` (project uses the rollup visualizer plugin).
- See `/lighthouse-budget-*.json` for exact metric numbers.
