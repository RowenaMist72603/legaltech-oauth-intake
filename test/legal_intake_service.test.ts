import assert from "node:assert/strict";
import { createMatter } from "../src/legal_intake_service.js";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, init) => {
  assert.deepEqual(JSON.parse(String(init?.body)), { widget_record_id: "widget-123", token: "pass", action: "matter_intake" });
  return new Response(JSON.stringify({ ok: true, data: { accepted: true }, metadata: {} }), { status: 200, headers: { "content-type": "application/json" } });
};
process.env.INFRAI_API_KEY = "test-key";
const result = await createMatter({ email: "counsel@example.com", name: "Ava", matter: "Lease review", widgetRecordId: "widget-123", captchaToken: "pass" });
assert.equal(result.matter, "Lease review");
assert.match(result.signedDocumentDelivery, /^signed:\/\//);
globalThis.fetch = originalFetch;
console.log("matter intake decision: accepted and signed delivery issued");
