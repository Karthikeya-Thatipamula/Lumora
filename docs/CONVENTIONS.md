# Conventions

These describe what the code already does. Where a linter can enforce a rule, it does —
the entries below marked **enforced** will fail `npm run verify`.

For _why_ the layers and the theming work the way they do, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Components

```tsx
interface SubscriptionCardProps {
  name: string;
  expanded?: boolean;
  onPress: () => void;
}

const SubscriptionCard = ({ name, expanded = false, onPress }: SubscriptionCardProps) => {
  // ...
};

export default SubscriptionCard;
```

- **`interface XProps`**, not `type XProps =`. Currently 30 of 30 typed components.
- Arrow function assigned to a const, not `function`.
- Props destructured in the signature, defaults inline.
- `extends TextInputProps` / `PressableProps` / `ViewProps` when wrapping an RN primitive.
- **`export default`** for anything a screen renders. Named exports are for the styled
  primitives and multi-export utility files (`SafeAreaView`, `Animated`, `Skeleton`).
- One component per file, named the same as the file.

**No `React.memo`, `useCallback` or `useMemo` inside components.** `reactCompiler` is
enabled in `app.config.js`; hand-memoising fights it and adds noise. `useMemo` in screens
for expensive derived data is fine.

## Styling

`className` everywhere. **Zero `StyleSheet.create` in the codebase** — 694 `className`
against 47 inline `style`, and the inline ones are all legitimate: percentage widths,
animated transforms, colours computed from data, and chart props.

- **Conditionals use `clsx`.** _(enforced — template literals emit a literal `"false"`
  class when the condition is falsy.)_
- **Never a hex literal.** Read `useThemeColors()` for raw style props. The only exception
  is `app/_layout.tsx`, whose screens render before the styled tree exists.
- Shared visual patterns are `@layer components` classes in `global.css`, not wrapper
  components. There is no `<Button>` or `<Card>`; the primitive layer is CSS.
- **`className` on an unregistered component is silently dropped.** _(enforced by
  `lumora/no-classname-on-unregistered` and `npm run check:interop`.)_ Import
  `SafeAreaView` from `@/components/SafeAreaView` and animated views from
  `@/components/motion/Animated`.

> Known wart: the `global.css` class names encode where they were first used, not what
> they are. `auth-card` is the universal card primitive and appears 35 times outside auth.
> Renaming touches ~694 call sites and is not yet done.

## Types

- `strict: true`, and **no `any`, `as any`, `@ts-ignore` or `@ts-expect-error`** anywhere.
  The codebase currently has zero of each. Keep it that way; if a type is genuinely
  unknowable, use `unknown` and narrow.
- Domain types come from Convex. `Doc<'subscriptions'>` is derived from `convex/schema.ts`,
  so the schema is the single source of truth and drift is a compile error.
- Prefer literal unions over `string` for anything with a fixed set of values, and declare
  them as Convex validators with `Infer<>` rather than as arrays mapped to `v.literal` —
  the spread form loses literal inference and widens back to `string`.

## Error handling

Every mutation call site follows the same shape:

```ts
try {
  await deleteSubscription(item.id);
  posthog.capture('subscription_deleted', { subscription_id: item.id });
} catch (error) {
  console.error('Delete subscription failed:', error);
  alertDialog('Delete failed', RETRY_WHEN_LOADED);
}
```

- Use `alertDialog` / `confirmDialog` from `lib/dialogs.ts`, never `Alert.alert`. Alert is
  a **silent no-op on react-native-web**, which turns every confirmation into a dead button.
- `RETRY_WHEN_LOADED` is the shared copy for the "Convex hasn't finished authenticating"
  case, which is the common failure.
- **`console.log` and `console.info` are banned** _(enforced)_. `warn` and `error` are
  allowed inside catch blocks. Anything you actually want to see belongs in PostHog.
- Functions that can fail in expected ways return a discriminated result
  (`{ ok: true } | { ok: false, reason }`) rather than throwing — see `lib/export.ts`.
- Guard defensively at boundaries. `formatCurrency` survives NaN, Infinity and unknown
  currency codes; `getHasOnboarded` fails open so a storage error can't trap a user.

## Analytics

- `usePostHog()` inside components; the `posthog` singleton only where there is no hook.
- **Never put user input in an event property.** Route params are allow-listed to
  `['id', 'tab', 'view']` in `app/_layout.tsx` for exactly this reason.
- Key screen-view effects on `subscriptions.length`, not the array — the array identity
  changes on every Convex push and re-fires the event, inflating every funnel.
- Debounce anything driven by typing.

## Tests

Colocated in `__tests__/` next to what they cover.

**Three RNTL v14 behaviours that will cost you an afternoon otherwise:**

```tsx
// `render` is async and returns nothing. Query through `screen`.
await render(<SubscriptionCard {...props} />);
expect(screen.getByText('Netflix')).toBeTruthy();

// `fireEvent` is async too. An un-awaited call that triggers a state update produces
// "overlapping act() calls" and corrupts EVERY LATER TEST IN THE FILE — which surfaces
// as unrelated "unable to find element" failures.
await fireEvent.changeText(screen.getByPlaceholderText('e.g. 150'), '200');
await fireEvent.press(screen.getByText('Save'));

// jest.mock factories may only close over names prefixed with `mock`.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
```

Test the arithmetic that is invisible when it is wrong — trial countdowns, split-plan
shares, currency totals, accessibility labels that carry a price — not that a component
renders.

## Commits

Conventional Commits, **enforced** by commitlint on `commit-msg`.

```
fix: stop the trial countdown going negative after the trial lapses
```

Types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`,
`style`, `test`. Subject capped at 100 characters; the body has no line limit, because
pasted stack traces and URLs are the context worth keeping.

## Comments

Explain **why**, never what. This codebase is unusually good at it and it should stay that
way — most of its hardest bugs are documented at the site of the workaround:

```ts
// The category colour reads as a spine rather than a fill. Filling the card
// with these light pastels left near-white dark-mode text unreadable on top.
```

If you work around a platform quirk, write down the quirk. The next person cannot
rediscover it from the code alone.
