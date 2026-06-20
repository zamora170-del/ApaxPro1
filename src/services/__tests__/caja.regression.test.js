import { describe, it, expect, beforeEach } from "vitest";
import { initDB, db, T } from "../../db/index.js";
import { abrirCaja, registrarPago, registrarEgreso } from "../caja.js";

// Hallazgo #5: registrarPago/registrarEgreso no validan monto > 0.
// Un monto negativo o cero altera el saldo de caja sin ninguna guarda.

describe("caja — validación de monto (hallazgo #5)", () => {
  beforeEach(() => {
    initDB();
    abrirCaja(0, 1);
  });

  it("registrarPago debe rechazar un monto negativo", () => {
    expect(() => registrarPago(1, -100, "efectivo", null, 1)).toThrow();
  });

  it("registrarPago debe rechazar un monto de cero", () => {
    expect(() => registrarPago(1, 0, "efectivo", null, 1)).toThrow();
  });

  it("registrarEgreso debe rechazar un monto negativo", () => {
    expect(() => registrarEgreso("compra repuestos", -50, "efectivo", 1)).toThrow();
  });

  it("registrarEgreso debe rechazar un monto de cero", () => {
    expect(() => registrarEgreso("compra repuestos", 0, "efectivo", 1)).toThrow();
  });
});
