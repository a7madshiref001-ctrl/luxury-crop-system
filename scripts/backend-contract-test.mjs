import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

let rpcCall;
const fakeClient = {
  rpc: async (name, args) => { rpcCall = { name, args }; return { data: { order_number: 91, total: 18 }, error: null }; },
  auth: {},
  from: () => ({})
};
const window = {
  BACKEND_CONFIG: { url: "https://example-project.supabase.co", publishableKey: "p".repeat(60) },
  supabase: { createClient: () => fakeClient }
};
vm.runInNewContext(fs.readFileSync("assets/backend.js", "utf8"), { window, console, Date });

assert.equal(window.Backend.configured(), true);
const result = await window.Backend.placeOrder({
  table_no: 3,
  customer_name: " أحمد ",
  customer_phone: "0512345678",
  idempotency_key: "order_12345678901234567890",
  client_id: "client_12345678901234567890",
  lines: [{ kind: "product", id: "180992", qty: 1, price: 0, total: 0, note: " بدون سكر " }]
});

assert.equal(rpcCall.name, "place_order");
assert.equal(rpcCall.args.p_order.lines[0].id, "180992");
assert.equal("price" in rpcCall.args.p_order.lines[0], false, "Client price must never be sent as authoritative data");
assert.equal("total" in rpcCall.args.p_order.lines[0], false, "Client total must never be sent as authoritative data");
assert.equal(rpcCall.args.p_order.customer_name, "أحمد");
assert.equal(result.order_number, 91);
console.log("PASS: backend contract excludes client prices/totals and uses the protected RPC.");
