# Sending a quote when sales tax is unavailable

Quotes are proposals and may be sent before sales tax is final. A QuickBooks
permission or connection problem should let the sender decide whether to send
the quote. Taxable invoices still require the existing QuickBooks calculation
and export before sending.

In the quote email composer, select **Send Quote** (or **Resend**). If the sender
cannot calculate tax, QuickBooks is disconnected, or an attempted calculation
fails, a **Sales Tax Unavailable** confirmation explains that the saved tax may
be missing or out of date:

- **Send Quote Anyway** sends using the quote's current saved totals.
- **Cancel** returns to the composer, preserving recipients and message.

The confirmation applies to that send only, including resends. It does not
change the client's taxable flag, clear a saved tax amount, mark tax as fresh,
grant QuickBooks access, or create a persistent bypass. Review the quote's
totals and email text before choosing to send. This change does not add a
customer-facing provisional-tax label or alter PDF totals.

Admins with QuickBooks connected still calculate stale/missing tax before
sending. Successful calculation sends the updated totals without an override.
Tax-exempt quotes follow the existing send flow. Recipient, save/share-link,
and Gmail checks still apply. Save document edits before opening the composer.
Immediately before sending, the sender reads the saved quote and compares its
normalized document fields with the email snapshot, excluding recipients and
activity. A pending/failed save, changed server document, or failed read stops
the send with guidance to save or reload and compose again. This prevents a
known mismatch between locally edited email totals and saved share/PDF totals;
it does not add transaction locking against edits after that read.

Invoice sending is unchanged.

Implementation stays in `modules/quotes-builder.js`, using the existing
confirmation dialog and email sender. The dialog renders after the composer
so it appears above it. No API, permission, schema, or migration change is
needed. `sw.js` advances the shell version so installed clients receive the
updated script through the existing refresh prompt.

Local regression checks:

```sh
node tests/test_quote_send_tax_override.js
python tests/check_shell_version.py origin/master
python -m pytest -q tests/test_sales_tax_plumbing.py tests/test_send_settles_first.py tests/test_qbo_unwind_send.py tests/test_commit5_send_modals.py
```

Browser acceptance should use disposable local records and stubbed Gmail/QBO
transport: verify the confirmation appears above the composer, Cancel retains
the message without sending, confirmation sends the quote, a resend asks again,
and the same taxable client remains blocked in the invoice sender.

## Acceptance evidence — 2026-10-26

Verified locally against the working change based on `206ebbb`, shell v94:

- Node regression suite passed, including calculation success/failure and
  disconnected QuickBooks, per-send confirmation, prerequisites, and invoice
  blockers. The four Python suites above passed: **44 tests**.
- In the running FastAPI app at `http://127.0.0.1:8765`, a disposable member
  selected the quote through Dashboard → Quotes → quote → Send Quote. The
  confirmation appeared above the composer. Cancel preserved its content and
  left the quote a draft with zero `email_sent` entries. Confirming sent it:
  the persisted row became `sent` with one `email_sent` entry and tax still
  `null`. Resend required a new confirmation.
- For the same taxable company and member, sending an invoice showed
  **Sales Tax Unavailable**, offered no override, and left it a draft with
  zero `email_sent` entries.
- At 390 × 844, More actions → Resend reached the same confirmation. Its action
  was visible above the composer with no horizontal overflow; Cancel preserved
  the composer and recipient. Desktop was checked at 1280 × 800.
- The served quote-builder script's SHA-256 matched the working file:
  `6861b6ed242b777ad4badadd2cb7a12bab7545403ef641dc4a159aa0cb461be1`
  (rechecked on the final script at port 8766).

Additional review acceptance on port 8766 reproduced an unsaved quantity edit
sending a $200 email while the saved quote remained $100 in the first revision.
The revised browser flow blocks that edit with **Save Quote Changes** and opens
no composer. After Save Changes settles, confirming the override sends a $200
email matching the saved quantity of 2, adding exactly one `email_sent` entry.
Node regressions additionally cover differing server quantities/tax/client/terms,
pending saves, unsuccessful reads, malformed JSON, and network failures; all
refuse the send and release the busy state. Matching saved documents still send,
including newly calculated tax and recipient/activity-only differences.

Muse Wonder Full 1.0, medium, reviewed base `206ebbb` through `17b8f7a` read-only
(round `ltpapp-pr1-muse-full-medium-review-r1`) and returned production ready with
no confirmed defects. It identified the unsaved-draft mismatch as a pre-existing
risk; the lead treated the reproduced financial mismatch as blocking and fixed
it before final review. Optional audit logging and synchronous double-click
locking remain outside this change. Round 2 (`ltpapp-pr1-muse-full-medium-review-r2`) reviewed `38b94c4`
with Muse Wonder Full 1.0, medium, and returned **production ready: YES**, with
no blocking defects. The lead agrees. The reviewer independently reran the
Node suite, syntax check, shell guard, and 44 backend tests, and probed the
actual normalization and composer guards. Read failures and document mismatch
refuse sending; matching saved rows, fresh tax, resends, and recipient/activity
metadata differences send. Rare normalization differences (item key ordering,
numeric strings, or date fallbacks across midnight) may refuse a send until
reload/save; they cannot bypass the guard. The GET-to-POST concurrency window
is disclosed above. No review requested a merge or deployment.

Gmail delivery was stubbed; QuickBooks connection state and all records were
local fixtures. Live Gmail/QuickBooks delivery and physical iOS installation
were not exercised. No production data was changed. Publication scope is a
feature-branch PR against the repository's default branch, `master`; the owner
reserved merge approval for Landry. No merge or deployment is part of this change.
