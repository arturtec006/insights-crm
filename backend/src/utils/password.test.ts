import { test } from "node:test";
import assert from "node:assert/strict";
import { isPasswordStrongEnough, hashPassword, verifyPassword } from "./password";

// This policy now gates three paths — creating a user, changing a password and
// resetting a forgotten one — so a change here silently changes all three.

test("isPasswordStrongEnough requires length, both cases and a digit", () => {
  assert.equal(isPasswordStrongEnough("SenhaBoa123"), true);
  assert.equal(isPasswordStrongEnough("Redefinida123"), true);
});

test("isPasswordStrongEnough rejects each missing requirement", () => {
  assert.equal(isPasswordStrongEnough("Curta123"), false, "menos de 10 caracteres");
  assert.equal(isPasswordStrongEnough("semmaiuscula1"), false, "sem maiuscula");
  assert.equal(isPasswordStrongEnough("SEMMINUSCULA1"), false, "sem minuscula");
  assert.equal(isPasswordStrongEnough("SemNenhumDigito"), false, "sem digito");
  assert.equal(isPasswordStrongEnough(""), false);
});

test("isPasswordStrongEnough counts symbols toward length but does not require them", () => {
  // "77seven@76" is the shape a real user picked: it has a symbol and digits but
  // no uppercase, so the policy rejects it. Documented here because the mismatch
  // is deliberate, not an oversight.
  assert.equal(isPasswordStrongEnough("77seven@76"), false);
  assert.equal(isPasswordStrongEnough("77Seven@76"), true);
});

test("a hashed password verifies and a wrong one does not", async () => {
  const hash = await hashPassword("SenhaBoa123");
  assert.notEqual(hash, "SenhaBoa123", "nunca guardar em texto puro");
  assert.equal(await verifyPassword("SenhaBoa123", hash), true);
  assert.equal(await verifyPassword("SenhaBoa124", hash), false);
});

test("the same password hashes differently every time (salted)", async () => {
  const [a, b] = await Promise.all([hashPassword("SenhaBoa123"), hashPassword("SenhaBoa123")]);
  assert.notEqual(a, b, "dois hashes iguais indicariam ausencia de salt");
  assert.equal(await verifyPassword("SenhaBoa123", a), true);
  assert.equal(await verifyPassword("SenhaBoa123", b), true);
});
