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
and Gmail checks still apply. Invoice sending is unchanged.

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
  `176ed874e0a3bb11d9b9c39219bf6720d0e546377de2979c32b229bcd3407080`.

Gmail delivery was stubbed; QuickBooks connection state and all records were
local fixtures. Live Gmail/QuickBooks delivery and physical iOS installation
were not exercised. No production data was changed. Publication scope is a
feature-branch PR against the repository's default branch, `master`; the owner
reserved merge approval for Landry. No merge or deployment is part of this change.
