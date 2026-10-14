// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  readFixture,
  truncated,
  withDoctype,
  withoutComplemento,
  withTipo,
  withUuid,
  withVersion,
} from "../../../tests/support/cfdiVariants";
import { parseCfdi } from "./parseCfdi";

const base = readFixture("ingreso-bom-decl.xml");

describe("parseCfdi rejections", () => {
  it("rejects CFDI 3.3 as cfdi-3x with detail 3.3", () => {
    expect(parseCfdi(readFixture("rechazos/cfdi33.xml"))).toEqual({
      ok: false,
      reason: "cfdi-3x",
      detail: "3.3",
    });
  });

  it("rejects a CFDI 4.1 as cfdi-3x with detail 4.1", () => {
    expect(parseCfdi(withVersion(base, "4.1"))).toEqual({
      ok: false,
      reason: "cfdi-3x",
      detail: "4.1",
    });
  });

  it("rejects a well-formed non-CFDI document as not-cfdi", () => {
    expect(parseCfdi(readFixture("rechazos/no-es-cfdi.xml"))).toEqual({
      ok: false,
      reason: "not-cfdi",
    });
  });

  it("rejects truncated XML as malformed through the parsererror element", () => {
    const xml = truncated(base);
    const doc = new DOMParser().parseFromString(xml.replace(/^﻿/, ""), "application/xml");
    expect(doc.getElementsByTagName("parsererror").length).toBeGreaterThan(0);
    expect(parseCfdi(xml)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a DOCTYPE with ENTITY as malformed with detail dtd", () => {
    expect(parseCfdi(withDoctype(base))).toEqual({
      ok: false,
      reason: "malformed",
      detail: "dtd",
    });
  });

  it("rejects a 4.0 without TimbreFiscalDigital as no-timbre", () => {
    expect(parseCfdi(withoutComplemento(base))).toEqual({ ok: false, reason: "no-timbre" });
  });

  it("rejects a malformed UUID as no-timbre", () => {
    expect(parseCfdi(withUuid(base, "no-es-un-uuid"))).toEqual({
      ok: false,
      reason: "no-timbre",
    });
  });

  it("rejects an invalid TipoDeComprobante as not-cfdi", () => {
    expect(parseCfdi(withTipo(base, "X"))).toEqual({ ok: false, reason: "not-cfdi" });
  });

  it("rejects input over 2,000,000 characters as too-large", () => {
    expect(parseCfdi("a".repeat(2_000_001))).toEqual({ ok: false, reason: "too-large" });
  });
});
