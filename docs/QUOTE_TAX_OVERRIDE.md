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

Local regression checks (run from the repository root):

```sh
node tests/test_quote_send_tax_override.js
python tests/check_shell_version.py 065e301
python -m pytest -q tests/test_sales_tax_plumbing.py tests/test_send_settles_first.py tests/test_qbo_unwind_send.py tests/test_commit5_send_modals.py
```

## WPCOM acceptance evidence — 2026-10-26

This change targets **WPCom100/LTPApp**, based on `065e301` (`master`), with
shell v122 → v123. An earlier PR was mistakenly opened against its older
`juicebox6030/LTPApp` fork. This port preserves WPCOM's newer section pricing,
labor synchronization, and other upstream changes. Only quote sending, the
shell version, focused regression coverage, and this document change.

- The Node regression suite and JavaScript syntax check passed. The four
  backend suites above passed: **45 tests** on the WPCOM source.
- A running local FastAPI app at port 8767 used disposable records, a member,
  a taxable company, and stubbed Gmail/QuickBooks credentials and transport.
  Cancel preserved the composer and left the quote a draft with zero sends.
  Confirm sent it, recording one `email_sent` entry and leaving tax `null`.
- An unsaved quantity edit from 1 to 2 blocked the composer with **Save Quote
  Changes**. After saving, resend required tax confirmation again and sent
  exactly one additional email. Captured email showed $200.00, matching the
  saved quantity of 2 at $100.00 each.
- Desktop 1280 × 800 and phone viewport 390 × 844 showed confirmation above
  the composer. The phone confirmation action was visible and reachable with
  no horizontal overflow.
- The same taxable client's invoice, with due date and recipient supplied,
  showed **Sales Tax Unavailable** without an override, remained a draft,
  and recorded zero `email_sent` entries.
- Served quote-builder SHA-256 matched the working file:
  `15c7d8c7b0b31272120abb2270287e4780b2da7d001f760874232b181adec2e4`.

The regression suite covers calculation success/failure, disconnected QBO,
confirmation/cancel/retry, prerequisites and invoice blockers. It also covers
changed saved quantities/tax/client/terms, failed reads and pending saves;
these refuse sending and release the busy state. Matching saved documents,
fresh tax, and recipient/activity metadata differences allow sending.

## Review and limits

Muse Wonder Full 1.0 at medium reasoning reviewed the earlier fork change in
two rounds. The lead reproduced the unsaved-document totals mismatch and
fixed it before the second approval. The WPCOM port received a separate review
(`ltpapp-wpcom-muse-full-medium-review-r3`) of base `065e301` through `eeb12fa`.
Muse returned **production-ready: YES**, with no blocking findings, and the lead
agrees. The reviewer independently reran the Node suite, syntax and shell
checks, and 45 backend tests, and probed actual normalization, saved rental
windows, labor markers, recipient metadata, and pending-save refusal. The
follow-up documentation commit records this verdict and the owner's upstream
Actions clarification; application code is unchanged from the reviewed head.

Snapshot comparison may fail closed for unusual item key ordering, numeric
strings, or date fallbacks across midnight; reload/save resolves such cases.
The GET-to-POST concurrency window remains as described above. Override-specific
audit logging and synchronous double-click locking are outside this change.

Live Gmail/QuickBooks delivery and physical iOS installation were not tested.
No production records changed. Merge approval belongs to Landry. No merge or
deployment is authorized by this change. Acceptance checks ran locally.
The owner clarified that the disabled-Actions rule applies to their repositories; this upstream PR follows WPCOM's existing
workflow without changing repository settings.
