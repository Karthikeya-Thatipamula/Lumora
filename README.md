# Lumora

Lumora is a subscription tracker built with Expo Router, Clerk, Convex, RevenueCat, and PostHog. It tracks recurring subscriptions, warns you before free trials convert, surfaces spending insights, sends renewal reminders, and gates advanced features behind a Pro paywall.

## Features

- **Subscription tracking** — add, edit, pause, cancel and delete recurring costs; data syncs live across screens and devices via Convex.
- **Quick add** — one tap prefills any of ~19 popular services (Netflix, Spotify, ChatGPT, Figma…) with typical pricing, category and trial length. Everything stays editable before saving.
- **Free-trial alerts** — flag a subscription as a trial and Lumora counts down to the first charge, warns you two days out, and puts an at-risk card at the top of Home while there's still time to cancel for free.
- **Money reclaimed** — every cancellation feeds a running annualised savings total on Insights, and appears in the shareable Wrapped card.
- **Shared plans** — mark a subscription as split N ways and every total counts only your share, with the full price shown alongside.
- **Multi-currency** — 12 currencies, defaulted from the device locale so non-US users aren't forced into dollars.
- **Spending insights** — monthly/yearly spend, category breakdown, budget tracking, annual-switch suggestions, and (Pro) forecasts, smart suggestions and Wrapped.
- **CSV export** (Pro) — download your full history to open in Excel, Numbers or Sheets.
- **Invite a friend** — share sheet that leads with your own reclaimed total when you have one.
- **Filter, sort and archive** — status chips (All / Active / Trials / Paused / Archive) with live counts, four sort orders, and search across name, category and card.
- **Payment method tracking** — tag what each subscription is billed to, then search by card.
- **Weekly digest** — one Sunday-evening summary of the week ahead, skipped entirely when nothing is due.
- **Spend over time** (Pro) — six months of real spending rebuilt from your own start dates, status changes and price history.
- **Help & FAQ** — in-app answers covering what Lumora does and does not do.
- **Discovery audit** — prompts for the categories you have nothing tracked in (music, cloud, gym, gaming, VPN…), because the one thing a manual tracker can't see is what you never entered.
- **Renewal calendar** — month grid showing which days your money actually leaves, with a per-day breakdown.
- **Cost at a glance** — the same commitment shown daily, weekly, monthly and yearly.
- **Cancellation links** — opens the provider's own cancellation page for known services. Lumora never claims to cancel for you.
- **Delete account and data** — one button, in-app, wipes everything.
- **CSV import** — paste an export from another tracker or a spreadsheet; forgiving about column names, reports skipped rows by line number.
- **Income context** — subscriptions as a share of monthly take-home, with a plain-language band.
- **What-if simulator** — tap subscriptions off to see what cancelling them would save, without changing any data.
- **Per-subscription reminder lead time** — override the account default for individual subscriptions.
- **Duplicate guard** — warns before adding a second copy of something already tracked.

Two deliberate modelling choices: running trials are excluded from spend totals until they
convert (you aren't being charged yet) and surfaced separately as "what starts if you keep
every trial"; and shared plans count only the owner's share, since that's what actually
leaves their account.

Annual-switch savings are estimates from a typical "two months free" discount, labelled as
such in the UI — Lumora has no pricing feed and never presents them as quotes.

## Stack

- **Expo / React Native** — app shell, file-based routing via `expo-router`
- **Clerk** — authentication (email/password)
- **Convex** — backend data store, synced in real time, scoped per Clerk user
- **RevenueCat** (`react-native-purchases`) — Pro entitlement + in-app purchases
- **expo-notifications** — local renewal reminders (no push server required)
- **PostHog** — product analytics
- **NativeWind / Tailwind v4** — styling
- **react-native-gifted-charts** — Insights charts

### Running in Expo Go

`npx expo start` and scanning the QR code works — no native modules beyond Expo Go's runtime
are used. Two capabilities degrade there, and the app says so in-app rather than failing
silently:

| | In Expo Go | In a dev/store build |
|---|---|---|
| Local notifications | Android can't schedule them; the toggle explains why | Full renewal, trial and digest reminders |
| RevenueCat / Pro | Preview mode; Pro-gated cards show a "not configured" placeholder | Real paywall and entitlements |

Everything else — Convex sync, insights, calendar, import/export, discovery, sharing — behaves
identically. Use a **development build** (`expo-dev-client`) when you need to test the paywall
or notifications for real.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values (see below).

3. Set up Convex — this is required to actually load data:
   ```bash
   npx convex dev
   ```
   This logs you in, creates/links a Convex project, and writes `EXPO_PUBLIC_CONVEX_URL` into `.env.local` for you (move it into `.env` or keep it in both — Expo reads all `.env*` files). Leave `npx convex dev` running in a separate terminal while developing so backend changes in `convex/` deploy automatically.

   Note: `convex/_generated/*` is checked into this repo as a hand-written stand-in (Convex normally generates it, but that requires a linked project first — a chicken-and-egg problem for a fresh clone). It's functionally identical to real codegen output, so the app builds and runs without it being regenerated. Running `npx convex dev` overwrites it with the official version automatically — nothing to do on your end.

   Without `EXPO_PUBLIC_CONVEX_URL` (or `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`) set, the app no longer crashes on startup — it shows an in-app "Setup required" screen listing exactly what's missing instead of a red-screen Metro error.

4. (Optional, for Pro/paywall testing) Create a RevenueCat project, connect your App Store Connect / Google Play Console apps, define a `pro` entitlement, and set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Without these, Pro-gated screens show a "not configured" placeholder instead of a paywall — the app still runs fine.

5. Build and run a development client:
   ```bash
   npx expo prebuild
   npx expo run:ios      # or: npx expo run:android
   ```
   Or build one via EAS: `eas build --profile development`.

### Required env vars

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog → Project Settings |
| `EXPO_PUBLIC_POSTHOG_HOST` | Usually `https://us.i.posthog.com` |
| `EXPO_PUBLIC_CONVEX_URL` | Written automatically by `npx convex dev` |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` | RevenueCat → Project Settings → API Keys (optional) |

Convex also needs `CLERK_JWT_ISSUER_DOMAIN` set as a **Convex** deployment env var (not an Expo one) — set it via the Convex dashboard or `npx convex env set CLERK_JWT_ISSUER_DOMAIN <your-clerk-frontend-api-url>`. Find that URL in Clerk's dashboard under the Convex native integration (Configure → Sessions), or it's your Clerk instance's Frontend API host.

## Project structure

- `app/` — file-based routes (Expo Router). `(auth)` is the signed-out stack, `(tabs)` is the signed-in app. `+not-found.tsx` handles bad links.
- `convex/` — backend schema and functions (`schema.ts`, `subscriptions.ts`, `userSettings.ts`).
- `lib/` — client-side hooks and pure logic (`useSubscriptions`, `insights.ts`, `notifications.ts`, `purchases.ts`, `csv.ts`).
- `components/` — shared UI, with `components/insights/*` composing the Insights tab.

### Conventions worth knowing

**Always import `SafeAreaView` from `@/components/SafeAreaView`.** NativeWind v5 only auto-maps
`className` onto core React Native components. Importing `SafeAreaView` straight from
`react-native-safe-area-context` silently drops the prop, so `flex-1` never applies, the view
collapses to the inset height, and the screen renders blank. The shared wrapper is `styled()`-ed
once so this can't recur.

**Read data through Convex `useQuery`, not one-shot `convex.query()`.** `lib/useSubscriptions.ts`
and `lib/useUserSettings.ts` pass `"skip"` until Clerk's JWT has been validated by Convex, then
subscribe. Every screen shares one live cache, so a mutation on any screen reflects everywhere
immediately — a per-component `useState` copy would go stale the moment another screen wrote.

**Validate on the server too.** `convex/validators.ts` enforces price bounds, name length, the
status enum, household size and date parseability inside the mutations. The client validates for
UX; Convex validates because the client isn't a trust boundary.

**`className` only works on components NativeWind has registered.** This is the sharpest edge
in the codebase and has caused three separate rounds of bugs: blank pages, unreadable text, and
unstyled buttons. NativeWind's `useCssElement` converts `className` into a style entry — but
only for components it knows. Pass `className` to `Animated.View`, a `createAnimatedComponent`
result, or safe-area-context's `SafeAreaView` and the prop is **silently dropped**: no error, no
warning, the element just renders naked.

Use the pre-wrapped versions:
- `import { SafeAreaView } from '@/components/SafeAreaView'`
- `import { AnimatedView, AnimatedText, AnimatedPressable } from '@/components/motion/Animated'`

`npm run check:interop` fails the build if anything regresses. Run it alongside lint.

**Overlays are a trap in React Native — and so is animating a disclosure.** Three attempts
at the same info-tooltip failed on device before the boring one worked: an absolutely
positioned popover painted *under* the card's own later siblings; an inline panel animated
with Reanimated `entering`/`exiting` settled correctly but rendered a frame before its
siblings reflowed, so it visibly overlapped while opening, left a gap while closing, and the
transition read as input lag. The third and current version is a plain conditional render:
it reflows in the same commit as the state change, so it is instant and cannot overlap.

 `position: absolute` only stacks above siblings that
come *earlier* in the tree — anything rendered after it in the same parent paints straight over
the top, and `zIndex` does not reliably save you. A tooltip popover built that way rendered on
top of the card's own content and the two texts overlapped illegibly on device. `LabelWithInfo`
now expands **inline**, pushing the card taller, which cannot collide with anything. Prefer
inline disclosure over floating panels.

**Do not set theme variables from JS.** Theming is pure CSS: `@theme` in `global.css` declares
the light palette inside `@layer theme`, and an **unlayered** `@media (prefers-color-scheme: dark)`
block overrides `:root`. Unlayered rules beat layered ones, so the dark values win everywhere —
including inside `@layer components`.

Wrapping the app in a `VariableContextProvider` to drive these from `useColorScheme()` looks
tempting and is a trap: on web it renders `<div style="--color-…">`, those inherited custom
properties beat the `:root` media query, and static prerendering bakes in the *light* palette —
pinning the entire app to light mode. It was tried and reverted. Add new colour tokens to the
`@theme` block and the dark media query, and to `constants/theme.ts` for raw style props.

**Never put theme-coloured text on a fixed-colour surface.** The category palette and the avatar
palette are always light, so anything drawn on them uses fixed dark ink rather than `text-primary`,
which inverts to near-white in dark mode and disappears. Subscription cards render the category
colour as a left spine instead of a background fill for the same reason.

## Where Lumora sits

The category splits in two. Bank-linked apps (Rocket Money) auto-detect subscriptions but
need your banking credentials, and get criticised for aggressive upselling. Manual trackers
(Bobby, Subby, TrackMySubs) are private and pleasant, but share one admitted weakness: *a
subscription you have forgotten never appears, because you never enter it.*

Lumora is a manual tracker that attacks that weakness directly rather than accepting it:

- **Discovery audit** asks about the categories you have nothing in, recovering most of what
  auto-detection would find at zero privacy cost.
- **Trial alerts** target the moment a manual tracker is worth the most — the window where
  cancelling is still free.
- **Money reclaimed** proves the app's value in currency, which no competitor surfaces.
- **Cancellation links** close the functional gap with bank-linked apps honestly: we point at
  the provider's page rather than pretending to act on your behalf.

Sources for the landscape read are listed at the bottom of this file.

## Motion

`components/motion/*` holds the animation primitives: `PressableScale` (spring press
feedback), `AnimatedNumber` (count-up headline figures), `Skeleton` (loading placeholders),
`GlowCard` (pulsing urgency border), `AuroraBackground`, `LogoMarquee`, `Accordion` and
`InfoTooltip`.

Two rules they follow:

**Touch has no hover.** Effects that depend on a cursor — hover states, cursor-following
spotlights, image trails, link previews — have no touch equivalent and aren't emulated.
The press itself carries the affordance instead, via `PressableScale`.

**Motion is an attention budget.** `GlowCard` pulses only while a trial is within two days
of charging. Spend it everywhere and it stops meaning anything.

`AnimatedNumber` runs on the JS thread via rAF rather than a Reanimated worklet, because
formatting the in-flight value needs `Intl`, which isn't available on the UI thread. The
easing maths lives in `lib/animation.ts` so it stays unit-testable.

## Branding

`components/LumoraLogo.tsx` is the in-app mark (vector, theme-aware, used on auth and onboarding).
`assets/logo.svg` is the same artwork as a standalone file — export it at 1024×1024 to regenerate
`assets/images/icon.png` and the Android adaptive icon layers, which are still the Expo defaults.

## Verifying a change

```bash
npm run verify        # lint + typecheck + interop guard + logic tests
```

Individually:

```bash
npm run lint
npx tsc --noEmit
npm run check:interop # catches className passed to unregistered components
npm run test:logic    # 242 assertions over the pure logic modules
```

`test:logic` stages the React-free modules with their `@/` imports rewritten, compiles them
with `tsc --strict`, and runs them under plain node — no test runner, no native mocks. The
suite lives in `scripts/logic-tests/run.ts`.

## Scripts

```bash
npm run lint            # expo lint
npm run check:interop   # catches className passed to unregistered components
npx tsc --noEmit        # typecheck
```

## Building for stores

`eas.json` has `development`, `preview`, and `production` profiles. Before your first store submission, double check:
- `app.config.js`'s `ios.bundleIdentifier` / `android.package` (currently `com.lumora.app` — change if you use a different developer account domain)
- App icons/screenshots and the placeholder copy in `app/legal/privacy.tsx` and `app/legal/terms.tsx` (needs legal review)
- RevenueCat products configured in App Store Connect / Google Play Console


## Landscape sources

- [Best Subscription Trackers of 2026 — CNBC Select](https://www.cnbc.com/select/best-subscription-trackers/)
- [Best Subscription Tracker Apps in 2026 — SubTracker](https://subtracker.io/best/best-subscription-tracker-apps)
- [Best Subscription Tracker Apps (2026) — Orbit Money](https://orbitmoney.io/compare/best-subscription-trackers)
- [8 Best Subscription Tracker Apps in 2026 — Resubs](https://resubs.app/resources/best-subscription-tracker-apps)
- [Subby — Subscription Tracker on Google Play](https://play.google.com/store/apps/details?id=com.slapp.subby&hl=en_US)
