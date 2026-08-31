import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhoneBR,
  normalizeDomain,
  normalizeEmail,
  normalizeInstagram,
  buildDedupeKey,
} from "./normalize";

test("normalizePhoneBR collapses every written form of one number", () => {
  const expected = "+5511987654321";
  for (const input of [
    "(11) 98765-4321",
    "11 98765 4321",
    "+55 11 98765-4321",
    "5511987654321",
    "0055 11 98765-4321",
    "  11987654321  ",
  ]) {
    assert.equal(normalizePhoneBR(input), expected, `failed for ${input}`);
  }
});

test("normalizePhoneBR handles landlines", () => {
  assert.equal(normalizePhoneBR("(11) 3333-4444"), "+551133334444");
  assert.equal(normalizePhoneBR("+55 21 2222-1111"), "+552122221111");
});

test("normalizePhoneBR takes the first number when a field packs several", () => {
  assert.equal(normalizePhoneBR("(11) 3333-4444; (11) 98765-4321"), "+551133334444");
  assert.equal(normalizePhoneBR("11 3333-4444 ou 11 99999-8888"), "+551133334444");
});

test("normalizePhoneBR rejects what it cannot trust", () => {
  assert.equal(normalizePhoneBR("98765-4321"), null, "no area code — guessing one would merge different cities");
  assert.equal(normalizePhoneBR("(10) 98765-4321"), null, "10 is not a Brazilian area code");
  assert.equal(normalizePhoneBR("(11) 18765-4321"), null, "mobiles always start with 9");
  assert.equal(normalizePhoneBR("(11) 1333-4444"), null, "landlines start with 2-5");
  assert.equal(normalizePhoneBR(""), null);
  assert.equal(normalizePhoneBR(null), null);
  assert.equal(normalizePhoneBR("nao informado"), null);
});

test("normalizeDomain reduces a URL to its bare host", () => {
  assert.equal(normalizeDomain("https://WWW.Example.com.br/contato?x=1"), "example.com.br");
  assert.equal(normalizeDomain("example.com.br"), "example.com.br");
  assert.equal(normalizeDomain("http://sub.example.com/"), "sub.example.com");
  assert.equal(normalizeDomain("not a url"), null);
  assert.equal(normalizeDomain("localhost"), null);
});

test("normalizeEmail lowercases and validates", () => {
  assert.equal(normalizeEmail("  Contato@Example.COM.br "), "contato@example.com.br");
  assert.equal(normalizeEmail("mailto:a@b.com?subject=oi"), "a@b.com");
  assert.equal(normalizeEmail("nope"), null);
});

test("normalizeInstagram extracts the handle from any form", () => {
  assert.equal(normalizeInstagram("https://instagram.com/Minha.Clinica/"), "minha.clinica");
  assert.equal(normalizeInstagram("@minha.clinica"), "minha.clinica");
  assert.equal(normalizeInstagram("https://www.instagram.com/p/Cabc123/"), null, "post URLs are not profiles");
  assert.equal(normalizeInstagram("com espaço"), null);
});

test("buildDedupeKey prefers phone, then domain, then name+city", () => {
  assert.equal(
    buildDedupeKey({ phone: "+5511987654321", websiteDomain: "a.com", companyName: "X", city: "SP" }),
    "phone:+5511987654321"
  );
  assert.equal(
    buildDedupeKey({ phone: null, websiteDomain: "a.com", companyName: "X", city: "SP" }),
    "domain:a.com"
  );
  assert.equal(
    buildDedupeKey({ companyName: "Clínica São José", city: "São Paulo" }),
    "name:clinica-sao-jose|city:sao-paulo"
  );
});

test("buildDedupeKey is stable across accent and casing differences", () => {
  const a = buildDedupeKey({ companyName: "Clínica São José", city: "São Paulo" });
  const b = buildDedupeKey({ companyName: "CLINICA SAO JOSE", city: "sao paulo" });
  assert.equal(a, b);
});
