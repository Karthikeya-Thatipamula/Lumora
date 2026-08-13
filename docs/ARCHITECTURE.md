# Architecture

Lumora is an Expo SDK 54 app: Expo Router for navigation, Convex for data, Clerk for auth,
RevenueCat for purchases, PostHog for analytics, Sentry for crashes.

## The layer rule

Dependencies point one way. `import/no-restricted-paths` in `eslint.config.js` enforces
this — a violation is a lint error, not a code-review note.

```
app/          routes only: screen composition, navigation, wiring hooks to views
   ↓
components/   UI. May import lib/, constants/, convex/. Never app/.
   ↓
lib/          hooks and domain logic. May import constants/, convex/. Never components/.
   ↓
constants/    static data and design tokens. Leaf.

convex/       the server. Imports nothing from the app.
```

Two consequences worth stating outright:

- **A screen should not contain business logic.** If a calculation is interesting enough
  to be wrong, it belongs in `lib/` where it can be tested without a renderer.
- **`convex/` never imports `@/lib`.** Convex bundles that directory on its own; reaching
  into client code would drag React into a server bundle. When the client and server need
  to share a definition, it lives in `convex/` and the client imports _down_ into it.

### Pure versus impure inside `lib/`

Modules whose name starts with `use` are React hooks. Everything else in `lib/` is
expected to be **pure and React-free** — no hooks, no native modules, no I/O. That split
is not cosmetic: it is what lets `lib/insights.ts` (the whole spend-analytics engine) be
tested headlessly, and it is why `lib/currency.ts` reads the device locale exactly once at
module load rather than through a hook.

The impure exceptions are deliberate and each says so in a docblock:
`notifications.ts`, `export.ts`, `share.ts`, `dialogs.ts`, `posthog.ts`, `monitoring.ts`.

## Data flow

```
Clerk session  ──►  ConvexProviderWithClerk  ──►  useQuery / useMutation
                                                        │
                                    lib/useSubscriptions.ts, lib/useUserSettings.ts
                                                        │
                                                    screens in app/
```

**Read through `useQuery`, never a one-shot `convex.query()`.** The live query is what
makes a write on one screen appear on another without a refresh. A one-shot read looks
like it works and then goes stale.

### The two-stage auth gate

Auth resolves in two stages: Clerk loads a session, then Convex exchanges and validates
that session's JWT. **Convex rejects every query until the second stage completes**, so a
query fired on `isSignedIn` alone will fail.

`lib/useConvexQueryGate.ts` is the single source of truth for this. Every `useQuery` in
the app passes `canQuery ? args : 'skip'`. It also distinguishes "still establishing the
session" from "signed out", because only the former should keep a spinner on screen.

### Route gating

There is no central guard. Gating is per-route-group, and the root layout deliberately
does _not_ redirect — an earlier `<Redirect>` there caused re-render churn:

| Location                 | Behaviour                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `app/_layout.tsx`        | Blocks render: shows `MissingConfigScreen` without env vars, a spinner while Convex auth resolves, an error screen if it fails. |
| `app/(tabs)/_layout.tsx` | The real inbound gate — redirects to sign-in when signed out. Also the only place `useNotificationSync()` mounts.               |
| `app/(auth)/_layout.tsx` | The inverse — bounces signed-in users to the tabs, and first-launch users to onboarding.                                        |

Routes outside those groups (`paywall`, `import`, `help`, `subscriptions/[id]`, `legal/*`)
have no gate of their own and rely on their queries returning nothing.

## The trust boundary is `convex/`

`convex/validators.ts` says it in its own docblock: the client is not a trust boundary. A
stale build, a retried mutation or a hand-crafted call can all put bad values in.

- Every query and mutation calls `requireUserId(ctx)` from `convex/model.ts` **and**
  re-checks `doc.userId !== userId` before touching a row.
- Both tables have a `by_user` index; every query uses `.withIndex()`, never `.filter()`.
- Prefer making an invalid value **unrepresentable** with `v.union(v.literal(...))` in the
  arg validator over rejecting it with an assert helper.
- `@convex-dev/eslint-plugin` enforces argument validators and explicit table ids.

Anything the client checks for UX reasons must also be checked here, or it is not
enforced.

### Plan limits

The free-tier limit is enforced by `getHeadroom` in `convex/model.ts`, not by the client.
It was previously a client-only constant checked at a single screen, and CSV import
skipped it entirely.

Convex cannot ask the client whether it is Pro — a mutation argument is
attacker-controlled. Instead the `entitlements` table mirrors RevenueCat, written only by
the webhook in `convex/http.ts`. An absent row means free, which is the correct default
for a deployment where RevenueCat is not configured.

Two details worth not rediscovering:

- **`CANCELLATION` does not revoke access.** It means auto-renew was switched off; the
  user is paid up until `expiration_at_ms`. Every decision goes through `isEntitledAt`,
  which looks at the expiry and never at the event type.
- **RevenueCat does not sign its webhooks.** The shared `Authorization` header is the
  whole security boundary, and sandbox events are rejected unless the deployment opts in —
  otherwise a TestFlight tester can grant themselves production Pro.

Counting is done with the `by_user_status` compound index and `take(limit + 1)`: six
document reads regardless of account size, and no denormalised counter to drift.

### Argument validators are safe to tighten; schema validators are not

Argument validators run at call time — tightening one can only reject a bad _new_ call.
Schema validators run against **every existing document** when you deploy, and a single
non-conforming row rejects the whole push.

So enum fields are tightened in two separate deploys:

1. Tighten the arg validator (`status` and `billing` are `v.union(v.literal(...))` today).
2. Run `convex/migrations.ts` against production and confirm it reports zero
   non-conforming rows.
3. Only then tighten `convex/schema.ts`, **deployed on its own**.

Step 3 has not been done — `schema.ts` still stores `status` and `billing` as
`v.string()`. Nothing is broken by that; it just means the database is one step behind
the arg validators. Run the migration first.

### The domain vocabulary

`convex/domain.ts` declares the validator and derives the type with `Infer<>`, never the
reverse. `v.union(...ARRAY.map(v.literal))` looks equivalent and is not — the spread loses
literal inference, TypeScript widens to `VUnion<string>`, and you are back to the drift
you were trying to remove.

`Subscription` in `lib/subscriptionTypes.ts` is `Omit<Doc<'subscriptions'>, '_id' |
'_creationTime' | 'userId'> & { id: string }`. Add a schema field and every consumer gains
it; remove one and every consumer fails to compile.

## Theming: two parallel sources, on purpose

Colours exist twice and must be kept in sync by hand:

| Source                      | Consumed by                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| `global.css` `@theme` block | Everything styled with `className`                                          |
| `constants/theme.ts`        | Chart libraries, the tab bar, and native controls that take raw style props |

The duplication is not an oversight. Charts and native components take colour _props_ and
cannot read CSS variables. `lib/useThemeColors.ts` picks the right map for the active
scheme; use it rather than writing a hex literal.

Theme preference is applied with `Appearance.setColorScheme` rather than a React context,
so React Native's `useColorScheme` and NativeWind's runtime can never disagree. A
`VariableContextProvider` approach was tried and reverted — it pinned web prerender to
light mode.

## The sharpest edge: `className` interop

NativeWind works by passing `className` to the **core React Native components it has
registered**. Pass it to anything else — safe-area-context's `SafeAreaView`, a Reanimated
`Animated.View`, `expo-image` — and the prop is **silently dropped**. No error, no
warning; the element just renders unstyled. This has caused three separate rounds of blank
page and unreadable text bugs.

This is intrinsic to NativeWind's design in v4 and v5 alike, not a bug in the preview
build, so there is no upstream release to wait for.

Two guards, both required:

1. `eslint-rules/no-classname-on-unregistered.js` — errors in-editor.
2. `scripts/check-classname-interop.mjs` — the CI backstop, wired into `npm run verify`.

Use the sanctioned wrappers: `@/components/SafeAreaView` and
`@/components/motion/Animated`. To register something new, wrap it with `styled()`.

## Testing layers

| Layer        | Tool        | Scope                                                                  |
| ------------ | ----------- | ---------------------------------------------------------------------- |
| Domain logic | Jest        | `lib/**` pure modules. 265 assertions ported from the old node runner. |
| Components   | Jest + RNTL | Behaviour and arithmetic that is invisible when wrong.                 |
| End-to-end   | Maestro     | `.maestro/` — needs a real build, runs nightly, not on PRs.            |

`npm run verify` runs format, lint, typecheck, the interop guard and the tests. CI runs
the same steps separately so a failure names itself.

## Configuration

`app.config.js` is JavaScript rather than `app.json` so it can read the environment. The
EAS project id, owner and Sentry plugin are all **omitted entirely when unset** rather than
emitted as `undefined` — a half-configured value fails at runtime, which is a much worse
place to discover it than at config time.

Everything `EXPO_PUBLIC_*` is compiled into the bundle and readable by anyone who downloads
the app. Only publishable keys belong there. See `.env.example`.
