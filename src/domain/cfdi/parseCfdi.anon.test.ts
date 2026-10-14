// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/support/cfdiVariants";
import { parseCfdi } from "./parseCfdi";
import type { ParsedInvoice } from "./types";

const SYNTHETIC_UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/;
const ANY_UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const FILES = ["anon-ingreso-descuento.xml", "anon-egreso.xml", "anon-pago.xml"] as const;

function parseOk(name: string): ParsedInvoice {
  const result = parseCfdi(readFixture(`anon/${name}`));
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason} ${result.detail ?? ""}`);
  }
  return result.invoice;
}

describe("anonymized fixtures", () => {
  it("anon-ingreso-descuento parses as I with a root descuento and >= 5 conceptos", () => {
    const invoice = parseOk("anon-ingreso-descuento.xml");
    expect(invoice.tipo).toBe("I");
    expect(invoice.descuento).not.toBeNull();
    expect(invoice.conceptos.length).toBeGreaterThanOrEqual(5);
  });

  it("anon-egreso parses as E", () => {
    expect(parseOk("anon-egreso.xml").tipo).toBe("E");
  });

  it("anon-pago parses as P with >= 1 Pago holding >= 1 DoctoRelacionado", () => {
    const invoice = parseOk("anon-pago.xml");
    expect(invoice.tipo).toBe("P");
    expect(invoice.pagos.length).toBeGreaterThanOrEqual(1);
    const doctos = invoice.pagos.flatMap((p) => p.doctos);
    expect(doctos.length).toBeGreaterThanOrEqual(1);
  });

  it("every UUID in the three files has the synthetic v4 shape", () => {
    for (const name of FILES) {
      const uuids = readFixture(`anon/${name}`).match(ANY_UUID_RE) ?? [];
      expect(uuids.length).toBeGreaterThan(0);
      for (const uuid of uuids) {
        expect(uuid.toUpperCase()).toMatch(SYNTHETIC_UUID_RE);
      }
    }
  });

  it("only the public generic RFCs appear", () => {
    const rfcs = new Set<string>();
    for (const name of FILES) {
      for (const m of readFixture(`anon/${name}`).matchAll(/\sRfc="([^"]*)"/g)) {
        rfcs.add(m[1] ?? "");
      }
    }
    expect([...rfcs].sort()).toEqual(["EKU9003173C9", "XAXX010101000"]);
  });
});

describe("scripts/anonymize-fixture.mjs", () => {
  const script = resolve(process.cwd(), "scripts/anonymize-fixture.mjs");
  const dir = mkdtempSync(join(tmpdir(), "anon-"));
  const realUuid = "c1746803-81f6-451f-99e2-13b62aa3b9db";

  function runOn(name: string, xml: string): string {
    const input = join(dir, `${name}-in.xml`);
    const output = join(dir, `${name}-out.xml`);
    writeFileSync(input, xml, "utf8");
    const stdout = execFileSync("node", [script, input, output], { encoding: "utf8" });
    expect(stdout).not.toContain(realUuid);
    return readFileSync(output, "utf8");
  }

  const sample = (uuid: string, extra: string): string =>
    `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="Z9" Folio="123456" Total="10.00" VendorAttr="secreto">` +
    `<cfdi:Emisor Rfc="AAA010101ZZZ" Nombre="EMPRESA REAL SA"/>` +
    `<cfdi:Receptor Rfc="BBB020202YYY" Nombre="OTRA EMPRESA REAL"/>` +
    `<cfdi:Conceptos><cfdi:Concepto Descripcion="Cafe de grano" Importe="10.00" NoIdentificacion="K-77"/></cfdi:Conceptos>` +
    `<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="${uuid}" NoCertificadoSAT="30001000000500003456" RfcProvCertif="PAC010101AAA"/>${extra}</cfdi:Complemento>` +
    `</cfdi:Comprobante>`;

  it("maps the same real UUID to the same synthetic UUID across files, case-insensitively", () => {
    const a = runOn("a", sample(realUuid.toUpperCase(), ""));
    const b = runOn("b", sample(realUuid, ""));
    const ua = a.match(/\sUUID="([^"]+)"/)?.[1];
    const ub = b.match(/\sUUID="([^"]+)"/)?.[1];
    expect(ua).toMatch(SYNTHETIC_UUID_RE);
    expect(ua).toBe(ub);
    expect(ua?.toLowerCase()).not.toBe(realUuid);
  });

  it("anonymizes by default and keeps only whitelisted structure", () => {
    const out = runOn("c", sample(realUuid, ""));
    for (const leaked of ["AAA010101ZZZ", "BBB020202YYY", "EMPRESA REAL", "OTRA EMPRESA", "Cafe de grano", "secreto", "30001000000500003456", "PAC010101AAA", "Z9", "123456", "K-77"]) {
      expect(out).not.toContain(leaked);
    }
    expect(out).toContain('Rfc="EKU9003173C9"');
    expect(out).toContain('Rfc="XAXX010101000"');
    expect(out).toContain('Descripcion="CONCEPTO 1"');
    expect(out).toContain('Total="10.00"');
    expect(out).toContain('Version="4.0"');
  });

  it("never prints input values to stdout", () => {
    const input = join(dir, "d-in.xml");
    writeFileSync(input, readFixture("ingreso-bom-decl.xml"), "utf8");
    const stdout = execFileSync("node", [script, input, join(dir, "d-out.xml")], {
      encoding: "utf8",
    });
    expect(stdout).not.toContain("PROVEEDOR DE PRUEBA");
    expect(stdout).not.toContain("EKU9003173C9");
  });
});
