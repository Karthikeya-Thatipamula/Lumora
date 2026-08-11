# Lumora — Go-Live Plan

Everything standing between the current build and a public Play Store listing, ordered by
what blocks what. Items marked **BLOCKER** will fail review or ship a broken app.

Run `npm run verify` before any build — it chains lint, typecheck, the className-interop
guard and the 265-assertion logic suite.

---

## 1. Production infrastructure — BLOCKERS

These are all currently pointed at development instances. The app _runs_, but not as a
product you can sell.

### 1.1 Clerk production instance — BLOCKER

The running app logs `Clerk has been loaded with development keys`. Development instances
have strict usage limits and are not for production.

- Create a **production instance** in the Clerk dashboard.
- Add your own domain, verify DNS.
- Put the live `pk_live_…` key in the production env (EAS secret, not `.env`).
- Re-run the Convex JWT template setup against the production instance.

### 1.2 Convex production deployment — BLOCKER

Currently on `karthikeya-thatipamula:lumora:dev`.

```bash
npx convex deploy            # creates/updates the prod deployment
npx convex env set CLERK_JWT_ISSUER_DOMAIN <production-clerk-frontend-api-url> --prod
```

Then set `EXPO_PUBLIC_CONVEX_URL` for production builds to the **prod** deployment URL.

### 1.3 RevenueCat — BLOCKER if Pro ships

`.env` has only `EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY`. In any real build,
`isPurchasesConfigured` is false, so every Pro path shows the "not set up" placeholder.

- Create the app in RevenueCat, connect Google Play.
- Define the `pro` entitlement (the ID the code checks — see `lib/purchases.ts`).
- Create the subscription product in Play Console **first**; RevenueCat imports it.
- Set `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
- Upload the Play service-account JSON to RevenueCat so it can validate receipts.

Alternative: ship v1.0 free, remove the paywall, add Pro in 1.1. That removes the entire
billing surface from first review, which is the single fastest path to being live.

### 1.4 PostHog

Already live and working. Confirm the project is not in a dev/EU-vs-US mismatch and that
the retention window matches what your privacy policy claims.

---

## 2. Legal and Play policy — BLOCKERS

### 2.1 Hosted privacy policy — BLOCKER

Play Console requires a **publicly reachable URL** — an in-app screen is not enough.
`app/legal/privacy.tsx` and `terms.tsx` are explicitly placeholder text and say so.

- Have both reviewed by someone qualified. They must describe the _actual_ data flow:
  Clerk (email, name, avatar), Convex (all subscription data), PostHog (usage analytics),
  RevenueCat (purchase state).
- Host them (a two-page static site is fine).
- Put the privacy URL in Play Console **and** in `app.config.js` so it is discoverable.

### 2.2 Data safety form — BLOCKER

Play Console will not publish without it. Declare honestly:

| Data               | Collected        | Purpose            | Optional?                                                                            |
| ------------------ | ---------------- | ------------------ | ------------------------------------------------------------------------------------ |
| Email address      | Yes (Clerk)      | Account management | Required                                                                             |
| Name, avatar       | Yes (Clerk)      | Account management | Optional                                                                             |
| App interactions   | Yes (PostHog)    | Analytics          | Required                                                                             |
| Purchase history   | Yes (RevenueCat) | Billing            | Required if Pro ships                                                                |
| **Financial info** | **No**           | —                  | Lumora holds self-reported subscription data, not bank or card data. Say so plainly. |

State that data is encrypted in transit and that users can request deletion — **which is
already true in-app** (Settings → Delete account and all data).

### 2.3 Account-deletion URL — BLOCKER

Play requires a **web URL** for deletion requests in addition to the in-app flow, for
users who have uninstalled. A simple form or a `mailto:` landing page on the same static
site satisfies this.

### 2.4 Content rating

Complete the questionnaire. Lumora is a finance/utility app with no user-generated
content, no ads, no gambling — it should rate as suitable for all ages. Note that it does
**not** provide financial advice; the in-app copy is already careful about this (bands are
labelled a rule of thumb, annual savings labelled estimates).

---

## 3. Build configuration

### 3.1 App icon — BLOCKER (cosmetic but visible)

`assets/images/icon.png` is still an Expo default. The Lumora mark exists as
`assets/logo.svg`. Export it at:

- `icon.png` — 1024×1024
- `android-icon-foreground.png` — 432×432, mark centred in the safe zone
- `android-icon-background.png` — solid `#0b0f1a` or the gradient
- `splash-icon.png` — 512×512
- Play Store listing icon — 512×512
- Feature graphic — 1024×500

### 3.2 Versioning

`app.config.js` has `version: '1.0.0'`. `eas.json` uses `appVersionSource: "remote"` with
`autoIncrement` on production, so EAS manages `versionCode`. Bump `version` manually per
release.

### 3.3 Package name — verify before first upload

`com.lumora.app` is **permanent once published**. If you do not own `lumora.app`, switch
to a domain you control (e.g. `com.karthikeya.lumora`). This cannot be changed later.

### 3.4 Permissions audit

Expo will merge permissions from installed modules. Before submitting, run
`npx expo prebuild` and read `android/app/src/main/AndroidManifest.xml`. Remove anything
unused — every permission is a review question and a conversion cost. Expect
`POST_NOTIFICATIONS` (needed, for reminders) and `INTERNET`.

### 3.5 ProGuard / release build

Do a real release build and smoke-test it. Debug and release differ in ways that bite:
minification, Hermes behaviour, and network security config.

---

## 4. Pre-submission testing

- [ ] `npm run verify` green
- [ ] Release build installed on a physical Android device (not Expo Go)
- [ ] **Notifications actually fire** — this cannot be tested in Expo Go on Android at all.
      Verify renewal reminders, trial alerts, weekly digest and budget alerts in a real build.
- [ ] Sign-up → verify email → add subscription → cancel → delete account, end to end
- [ ] Purchase flow against a Play **licence tester** account
- [ ] Restore purchases on a second device
- [ ] Offline: launch with no network, confirm no crash and a sensible empty state
- [ ] Dark and light mode, and the new System/Light/Dark override
- [ ] Small screen (≤5") and large/tablet — the modal scroll bug was exactly this class
- [ ] Font scaling at maximum accessibility size
- [ ] Back-button behaviour on every screen

---

## 5. Play Console submission

### 5.1 Closed testing — the long pole

Personal developer accounts created after **13 November 2023** must run a closed test with
**at least 12 testers opted in continuously for 14 days** before they can apply for
production access. Organisation accounts (registered legal entity) are exempt.

**This is a hard 14-day wall — start it first.** Everything else can be done in parallel.

After the 14 days, apply for production access; review is typically under 7 days.

### 5.2 Store listing

- Title (30 chars): `Lumora — Subscription Tracker`
- Short description (80 chars): lead with the differentiator, not the category.
  e.g. _"Track subscriptions, catch free trials before they charge, and see what you save."_
- Full description (4000 chars): lead with free-trial alerts and the discovery audit —
  they are what competitors do not have.
- 2–8 phone screenshots. Best candidates: the trial alert on Home, the renewal calendar,
  cost-per-use, and money reclaimed.
- No screenshot may misrepresent the app — do not show Pro features without noting they
  are paid.

### 5.3 Keywords worth targeting

Based on the category research, the highest-intent terms are _free trial reminder_,
_subscription tracker_, _cancel subscriptions_, _recurring payments_. Lumora genuinely
serves the first one, which most manual trackers do not.

---

## 6. Post-launch

- Watch PostHog for the activation funnel: sign-up → first subscription added → second.
  The discovery audit and quick-add exist to move exactly that number.
- Watch `trial_alert_shown` → `subscription_cancelled` — that ratio is the app's core
  value proposition, measured.
- Crash reporting is **not** currently wired up. Consider Sentry before scale; the
  `RouteErrorBoundary` catches render crashes in-app but reports nothing back to you.
- `.posthog-events.json` documents only 9 of ~40 events now emitted. Worth regenerating.

---

## Known gaps, deliberately deferred

| Gap                                 | Why it is acceptable for v1                  | When to fix                      |
| ----------------------------------- | -------------------------------------------- | -------------------------------- |
| No crash reporting                  | Error boundary degrades gracefully           | Before meaningful scale          |
| No home-screen widget               | Needs native modules, not Expo Go compatible | v1.1+                            |
| No shared/household workspace       | Requires multi-user backend design           | v1.2                             |
| Trial/renewal data is self-reported | Deliberate — it is the privacy position      | Never                            |
| No automated UI tests               | Logic is covered; UI verified manually       | Add Maestro if regressions recur |
