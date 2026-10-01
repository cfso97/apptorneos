---
name: next-lint-windows-quirk
description: "next lint" fails on this machine with "No se ha encontrado el archivo por lotes" even when ESLint itself is clean — use node_modules/.bin/eslint.CMD directly instead
metadata:
  type: project
---

On this Windows machine, `pnpm --filter @torneos-saas/web run lint` (which runs `next lint`) fails with exit code 1 and the error "No se ha encontrado el archivo por lotes" (batch file not found). This is an environment/spawning quirk in how Next.js's lint command shells out on Windows — it is NOT a real lint failure in the code.

**Why:** Confirmed by running ESLint directly instead: `node_modules/.bin/eslint.CMD "app/**/*.{ts,tsx}" "components/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}"` from `apps/web` — this ran cleanly (exit 0, 0 errors/warnings across 19 files) while `next lint` failed to even spawn correctly. Related to [[entorno_node_windows]] (two Node installs / PATH issues on this machine) but distinct symptom.

**How to apply:** When validating lint on this machine, don't trust a `next lint` failure at face value — fall back to invoking `eslint.CMD` directly from `node_modules/.bin` to get the real signal. If `next lint` keeps failing this way, worth flagging to the user as a potential `.nvmrc`/PATH-related environment issue to fix properly at some point (not urgent, there's a working bypass).
