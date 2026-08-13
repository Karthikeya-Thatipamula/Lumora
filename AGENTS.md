# Working in this repo

Lumora — Expo SDK 54 subscription tracker. Expo Router · Convex · Clerk · RevenueCat ·
PostHog · Sentry · NativeWind 5 (preview) + Tailwind 4.

## Read the versioned docs

**Expo HAS CHANGED.** Read <https://docs.expo.dev/versions/v54.0.0/> before writing code
against an Expo API. Do not rely on recalled API shapes — SDK 54 differs from earlier
versions in ways that look plausible and fail at runtime.

Version-sensitive things that have already bitten:

- `jest-expo` is versioned per SDK. Install with `npx expo install`, never `npm i` —
  npm `latest` is a different SDK line entirely.
- `@testing-library/react-native` v14 made `render` **and** `fireEvent` async.
- Convex 1.42 takes an explicit table name: `ctx.db.get('subscriptions', id)`.

## The gate

```bash
npm run verify   # format:check → lint → typecheck → check:interop → test
```

This must pass before anything is committed. `lint-staged` runs on commit and the full
suite runs on push, so a broken tree is caught locally rather than in CI.

## Rules that are enforced

These fail the build. They are not style preferences.

1. **`className` on a component NativeWind has not registered is silently dropped** — no
   error, no warning, the element renders unstyled. Import `SafeAreaView` from
   `@/components/SafeAreaView` and animated views from `@/components/motion/Animated`.
   Wrap anything new with `styled()`. This is intrinsic to NativeWind in both v4 and v5;
   there is no upstream fix coming.
2. **The layer rule.** `app/ → components/ → lib/ → constants/`, one direction only.
   `convex/` imports nothing from the app.
3. **No `console.log` / `console.info`.** `warn` and `error` in catch blocks only.
4. **Conventional Commits.**
5. **No `any` / `as any` / `@ts-ignore`.** The codebase has zero; keep it that way.

## Rules a linter cannot catch

- **Validate server-side in `convex/validators.ts`.** The client is not a trust boundary.
  Anything checked only in the UI is not enforced. Prefer making a bad value
  unrepresentable with `v.union(v.literal(...))` over rejecting it with an assert.
- **Read via `useQuery`, never a one-shot `convex.query()`.** The live query is what makes
  a write on one screen appear on another. A one-shot read looks fine and goes stale.
- **Every query needs the auth gate.** Convex rejects reads until Clerk's JWT is exchanged.
  Use `useConvexQueryGate()` and pass `canQuery ? args : 'skip'`.
- **Never a hex literal.** Use `useThemeColors()`. Hardcoded colours ignore dark mode.
- **Keep `lib/` pure.** Modules without a `use` prefix must stay React- and native-free so
  the domain logic remains headlessly testable. That property is load-bearing.
- **Never put user input in an analytics property.** Route params are allow-listed.

## Before you finish

- Run `npm run verify`.
- If you worked around a platform quirk, write the quirk down at the workaround. Most of
  this codebase's hardest bugs are documented that way and it is why they stay fixed.
- Update `docs/CONVENTIONS.md` if you established a new pattern, and `.posthog-events.json`
  if you added an event.

## More detail

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — layers, data flow, auth, trust boundary
- [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) — code style, testing, error handling
- [README.md](./README.md) — setup and features
- [GO-LIVE.md](./GO-LIVE.md) — release blockers
