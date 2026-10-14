# PaperSwipe App migration

## Current milestone: stability and shared code (local, not deployed)

- Trending and Explore use one checked JSON write path. Failed saves remain visible and do not show success; repeated Trending actions are blocked while saving/animating.
- Both card views share one pointer lifecycle and swipe threshold implementation. Cancellation/lost capture resets the card instead of committing an action. Secondary pointers and right clicks are ignored. Real iPhone testing is still required.
- Manual schedule dates, priorities, completion and removal are stored per account in the existing data volume. Schedule removal does not remove a Library collection. Dates pinned outside the displayed week are not automatically moved into it.
- Older data files with no `schedule` field remain readable. No production data was migrated or deleted. Back up data before deploying; rolling back to an older writer can drop new schedule fields when it saves.
- Cache payload budget: 32 MiB total across configured beta accounts, divided into fixed per-account shares, each at most 4 MiB. This is a cache payload budget, not a cap on total Go process memory. Idle expiry is automatic. Larger responses can still be served but are not cached if they exceed the account share.
- Keep two active expensive requests, plus at most 16 waiting requests. Updated clients opt in via `Prefer: wait=20`; wait expires after 20 seconds and cancellation frees the place. There is no strict FIFO/position guarantee. One outstanding costly request per account. Quota is consumed only after admission, following the existing generation policy. This is overload protection, not a claim of 130 concurrent users being supported.
- Login: 300 attempts/minute global safety limit; invalid-token attempts limited to 30/minute; valid credentials limited to 5 logins/account/minute. The limiter does not trust spoofable forwarded IPs. Existing one-active-session behavior is unchanged.
- Removed unreachable fake badge data and unused fallback-paper code; non-streaming summary entry delegates to the same pipeline as streaming.
- New shared files: `web/client-api.js`, `web/card-gestures.js`, `web/schedule-state.js`. Include the whole `web` directory when packaging releases.

## Verification

```sh
go test ./...
go vet ./...
python tests/mobile_stability.py
```

The browser test uses a private mock server and does not call a model or touch user data. It requires Python Playwright and Edge by default; set `PAPERSWIPE_TEST_BROWSER=chromium` to use bundled Chromium. CI installs Playwright and Chromium. Existing account-isolation, quota, summary and cache tests remain in place; new tests cover schedule recovery, failed writes, global cache budgeting, idle expiration and bounded waiting.

No iOS/Android/HarmonyOS native package has been built at this milestone. No live production load test, paid model benchmark or iPhone-device validation is implied.

## Next milestones

### Mobile foundation added locally (2026-10-13)

Android project and bundled UI build now live in `mobile/`. The opt-in backend mobile-auth channel, per-channel sessions, strict CORS and Android encrypted session vault are implemented. Browser cookie/CSRF behavior remains intact. No server was updated; `ENABLE_MOBILE_APP` stays off unless explicitly enabled in deployment. See [mobile/README.md](mobile/README.md) for prerequisites, tests and Windows build instructions. Native device validation and iOS/HarmonyOS projects remain outstanding.

1. Further separate feature modules and centralize rendering without redesigning the existing screens. Do not remove demo content still used by Trending or the reading assistant as if it were dead code.
2. Explicit API origin and Android platform-aware authentication/storage are implemented; validate on a real device and add corresponding iOS/HarmonyOS secure storage. Preserve browser CSRF protections.
3. iOS/Android native projects can share the web UI and Go backend. Add device lifecycle, safe area, keyboard/back navigation, network recovery and secure credential storage before distributing.
4. HarmonyOS NEXT requires its own project and platform validation; evaluate ArkWeb reuse plus ArkUI platform integration separately rather than assuming an Android package covers it.
5. All developers currently use Windows. iOS signing/build/testing needs access to macOS/Xcode (a managed Mac/cloud runner or a physical Mac), Apple account/certificates and real-device validation. Android and HarmonyOS SDKs, app identifiers and signing configuration also need setup. Do not purchase services or upload signing material without the owner's approval.

## Releases and cleanup

Keep the current release plus one known-good rollback release, source revision, protected configuration backup and recent data backups. Old upload archives are not runtime dependencies after extraction/build. Remove only verified redundant archives, never the app data or Caddy certificate volumes. No archives or Docker images were deleted during this milestone. `data/state.json` remains an existing tracked local runtime file; do not include it in the code commit or upload it to replace production data.
