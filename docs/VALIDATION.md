# Validation results — 2026-09-16

## Latest expanded review

- **58 automated checks passed:** 22 domain/API tests and 36 browser tests (18 scenarios on desktop and mobile).
- Every one of the 64 products was opened in the browser; all product images loaded, detail dialogs rendered, and no dialog overflow or page JavaScript errors were found.
- Browser coverage: Arabic/English search, categories, favorites, sorting across language changes, dark-mode persistence, cart variants, quantity limits, notes, coupons, table QR override, pickup, delivery, phone normalization, order tracking and all fulfillment stages.
- Recovery coverage: lost response after an accepted order produces no duplicate; pending order edits are locked; backend reconnection; deleted open products; late tracking responses; corrupt browser storage; slow initial loading.
- Owner coverage: sign-in, menu/category editing, XSS text escaping, cross-device availability, unsaved-change protection, revision conflicts, responsive navigation, order receipts and print media, customer CSV, JSON/SQLite backups, feedback and retryable logout.
- GitHub Pages fallback: browsing works without API; admin clearly explains the hosting limitation and hides its unusable login form.
- API/data coverage: server price calculation, exact coupon allocation including free products, input validation, UTF-8 chunk boundaries, status rules, consent/loyalty redemption, auth, CSRF, private files, idempotency, concurrency and persistent database restart.
- Asset/syntax check: passed; 64 unique products, 10 categories, 64 WebP files, 3.23 MB total.
- Production dependency audit: 0 vulnerabilities reported.
- Git diff whitespace check: passed.
- Original product IDs, category membership and prices remain unchanged.
- Browser viewport sizes: 1440×1050 and 390×844, Chrome. Test servers use unique isolated data directories; no test orders enter the real local database.

## Deployment scope

The new repository starts with clean history. GitHub Pages publishes only static interface/catalog assets; runtime databases, credentials and backend source files are excluded from the site artifact. Shared ordering and authenticated owner operations are verified on the local Node 24 server. GitHub Pages cannot run that server. Docker builds and independent penetration/load testing were not performed.

Evidence: tests/system.test.js, tests/ui/customer.spec.js, tests/ui/regression.spec.js and the screenshots in docs/.
