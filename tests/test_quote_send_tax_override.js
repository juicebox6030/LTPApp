// Exercise the actual builder send handlers in isolation, with email/QBO
// boundaries stubbed. Run: node tests/test_quote_send_tax_override.js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const quote = fs.readFileSync(path.join(root, "modules/quotes-builder.js"), "utf8");
const invoice = fs.readFileSync(path.join(root, "modules/invoices.js"), "utf8");

function between(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert(from >= 0 && to > from, "send-handler boundaries exist");
  return source.slice(from, to);
}
const handlers = between(quote, "    function confirmSendQuoteWithoutTax(", "    function sendQuoteEmail(");
const invoiceHandler = between(invoice, "    function executeSend()", "    function sendInvoiceEmail(");

function fixture(overrides = {}) {
  const calls = { sent: [], alerts: [], calculations: 0 };
  const ctx = {
    window: { LTP_GMAIL_CONNECTED: true },
    draft: { id: 1, shareToken: "local-quote", qbTaxTotal: 17, status: "draft" },
    sendRecipients: { to: ["client@example.com"] },
    customerTaxable: true, isAdmin: false, qbConnected: true, taxFresh: false,
    dlg: null, sending: false,
    setDlg(dlg) { ctx.dlg = dlg; },
    setSending(value) { ctx.sending = value; },
    showAlert(...args) { calls.alerts.push(args); },
    sendQuoteEmail(row) { calls.sent.push(row); },
    sendInvoiceEmail(row) { calls.sent.push(row); },
    billingParty() { return { taxable: true }; },
    calcQuoteTax() { calls.calculations++; return Promise.resolve(ctx.calculated); },
    ...overrides,
  };
  ctx.draft.clientType = "company";
  vm.createContext(ctx);
  vm.runInContext(handlers + invoiceHandler, ctx);
  return { ctx, calls };
}

async function run() {
  for (const overrides of [{}, { qbConnected: false }, { isAdmin: true, qbConnected: false }]) {
    const { ctx, calls } = fixture(overrides);
    ctx.executeSendQuote();
    assert.equal(calls.sent.length, 0, "never sends before confirmation");
    assert.equal(calls.calculations, 0, "does not attempt an unauthorized calculation");
    assert.equal(ctx.dlg.confirmLabel, "Send Quote Anyway");
    assert.match(ctx.dlg.message, /missing or out of date/);
    const before = JSON.stringify(ctx.draft);
    ctx.setDlg(null); // same action as the rendered dialog's Cancel handler
    assert.equal(calls.sent.length, 0, "cancel sends nothing");
    ctx.executeSendQuote();
    ctx.dlg.onConfirm();
    assert.equal(ctx.dlg, null);
    assert.equal(calls.sent[0], ctx.draft, "override sends the saved row");
    assert.equal(JSON.stringify(ctx.draft), before, "override does not change tax or status");
    ctx.executeSendQuote();
    assert(ctx.dlg, "the next send requires another confirmation");
    assert.equal(calls.sent.length, 1);
  }
  {
    const { ctx, calls } = fixture({ isAdmin: true, calculated: null });
    ctx.executeSendQuote();
    await Promise.resolve();
    assert.equal(calls.calculations, 1);
    assert.equal(ctx.sending, false, "failed calculation releases busy state");
    assert.equal(calls.sent.length, 0);
    ctx.dlg.onConfirm();
    assert.equal(calls.sent[0], ctx.draft);
  }
  {
    const updated = { id: 1, qbTaxTotal: 25 };
    const { ctx, calls } = fixture({ isAdmin: true, calculated: updated });
    ctx.executeSendQuote();
    await Promise.resolve();
    assert.equal(calls.sent[0], updated, "successful calculation sends fresh totals");
    assert.equal(ctx.dlg, null);
  }
  for (const overrides of [{ customerTaxable: false }, { isAdmin: true, taxFresh: true }]) {
    const { ctx, calls } = fixture(overrides);
    ctx.executeSendQuote();
    assert.equal(calls.sent[0], ctx.draft);
    assert.equal(calls.calculations, 0);
    assert.equal(ctx.dlg, null);
  }
  for (const overrides of [{ sendRecipients: { to: [] } }, { window: { LTP_GMAIL_CONNECTED: false } }, { draft: {} }]) {
    const { ctx, calls } = fixture(overrides);
    ctx.executeSendQuote();
    assert.equal(calls.alerts.length, 1, "existing send prerequisites still apply");
    assert.equal(calls.sent.length, 0);
    assert.equal(ctx.dlg, null);
  }
  for (const overrides of [{}, { qbConnected: false }, { isAdmin: true, qbConnected: false }]) {
    const { ctx, calls } = fixture(overrides);
    ctx.executeSend();
    assert.equal(calls.sent.length, 0, "taxable invoices remain blocked");
    assert.equal(calls.alerts[0][0], "Sales Tax Unavailable");
    assert.equal(ctx.dlg, null, "invoice has no override");
  }
  console.log("PASS: quote tax confirmation, cancellation, retry, calculation, prerequisites, and invoice blockers");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
