---
name: lumora-conventions
description: Lumora's enforced coding rules and the platform landmines that are invisible in the code. Load before writing or reviewing any code in this repo — Expo Router screens, Convex functions, NativeWind styling, hooks in lib/, or tests. Also covers the version-sensitive tooling (jest-expo, RNTL v14, Convex 1.42) whose APIs differ from what you may recall.
---

# Lumora conventions

Expo SDK 54 · Expo Router · Convex · Clerk · RevenueCat · PostHog · Sentry ·
NativeWind 5 preview + Tailwind 4.

Full detail lives in `docs/ARCHITECTURE.md` and `docs/CONVENTIONS.md`. This is the
short version — the things that are wrong in ways you will not notice.

## Check first

```bash
npm run verify   # format:check → lint → typecheck → check:interop → test
```

## The four silent failures

These produce no error. The code looks right and behaves wrong.

**1. `className` on an unregistered component is dropped.**
NativeWind only wires `className` through the core RN components it has registered.
Pass it to safe-area-context's `SafeAreaView`, a Reanimated `Animated.View`,
`expo-image`, `react-native-svg` or a chart, and the element renders **unstyled**. Three
rounds of blank-page bugs came from this. Intrinsic to NativeWind v4 and v5 alike — not
a preview bug, no upstream fix coming.

→ Import `SafeAreaView` from `@/components/SafeAreaView`, animated views from
`@/components/motion/Animated`. Wrap anything new with `styled()`.

**2. A query fired before Convex auth resolves just fails.**
Auth is two-stage: Clerk loads a session, _then_ Convex validates its JWT. `isSignedIn`
alone is not enough.

→ `const { canQuery } = useConvexQueryGate();` then `useQuery(api.x.y, canQuery ? {} : 'skip')`.

**3. A one-shot `convex.query()` goes stale.**
It returns correct data once and never updates, so a write on another screen never
appears. Always `useQuery`.

**4. A check that exists only in the UI is not enforced.**
Convex functions are publicly callable. `convex/validators.ts` is the trust boundary.
Prefer `v.union(v.literal(...))` in the arg validator — making a bad value
unrepresentable beats rejecting it.

## Enforced by the build

- Layer rule: `app/ → components/ → lib/ → constants/`, one direction. `convex/` imports
  nothing from the app.
- No `console.log` / `console.info`. `warn`/`error` in catch blocks only.
- No `any`, `as any`, `@ts-ignore`. The codebase has zero.
- `clsx` for conditional classes — a template literal emits a literal `"false"` class.
- Conventional Commits.

## Version-sensitive APIs

Do not write these from memory; they differ from earlier versions.

| Thing                          | Correct form                                                   |
| ------------------------------ | -------------------------------------------------------------- |
| Convex 1.42 db access          | `ctx.db.get('subscriptions', id)` — explicit table name        |
| RNTL v14 render                | `await render(...)`, then query via `screen` (returns nothing) |
| RNTL v14 events                | `await fireEvent.press(...)` — un-awaited breaks _later_ tests |
| `jest.mock` factory            | may only close over `mock`-prefixed names                      |
| Installing Expo-versioned deps | `npx expo install`, never `npm i`                              |

Read <https://docs.expo.dev/versions/v54.0.0/> before using an Expo API.

## Code shape

```tsx
interface ThingCardProps {
  name: string;
  onPress: () => void;
}

const ThingCard = ({ name, onPress }: ThingCardProps) => {
  /* ... */
};

export default ThingCard;
```

`interface XProps`, arrow function, `export default` for screens. No `React.memo` /
`useCallback` / `useMemo` in components — `reactCompiler` is on.

Mutations always: `try` → `posthog.capture` → `catch` → `console.error` +
`alertDialog(title, RETRY_WHEN_LOADED)`. Never `Alert.alert` directly; it is a silent
no-op on web.

Never a hex literal — `useThemeColors()`. Colours exist twice on purpose
(`global.css` for `className`, `constants/theme.ts` for chart and native props).

Keep non-`use*` modules in `lib/` pure and React-free. That is what makes the domain
logic headlessly testable, and it is load-bearing.

## Comments

Explain **why**. If you work around a platform quirk, document the quirk at the
workaround — this codebase's hardest bugs stay fixed because someone did.
