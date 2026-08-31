import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreLead } from "./score";

test("completeness rewards every channel you can reach the business on", () => {
  const full = scoreLead({
    phone: "+5511987654321",
    email: "a@b.com",
    websiteDomain: "b.com",
    instagram: "b",
    addressLine: "Rua X, 1",
    category: "dentist",
    latitude: -23,
    longitude: -46,
  });
  assert.equal(full.score, 100);

  const bare = scoreLead({ category: "dentist" });
  assert.equal(bare.score, 5);
});

test("needs-web-presence prefers a reachable business with no site", () => {
  const target = scoreLead({ phone: "+5511987654321", instagram: "x", addressLine: "Rua X, 1" }, "needs-web-presence");
  const alreadyServed = scoreLead(
    { phone: "+5511987654321", instagram: "x", addressLine: "Rua X, 1", websiteDomain: "x.com" },
    "needs-web-presence"
  );
  assert.ok(target.score > alreadyServed.score, "a business without a site must outrank one that has one");
  assert.equal(target.score, 90);
  assert.equal(alreadyServed.score, 50);
});

test("score is always clamped to 0-100 and explains itself", () => {
  const r = scoreLead({ websiteDomain: "x.com" }, "needs-web-presence");
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.deepEqual(r.signals, [{ label: "Já tem site", points: -10 }]);
});
