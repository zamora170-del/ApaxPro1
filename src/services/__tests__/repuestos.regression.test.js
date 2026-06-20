import { describe, it, expect, beforeEach } from "vitest";
import { initDB, db, T } from "../../db/index.js";
import {
  crearRepuesto,
  reservarRepuesto,
  instalarRepuesto,
  liberarReservasVencidas,
} from "../repuestos.js";

function crearRepuestoConStock(stock = 10) {
  return crearRepuesto(
    { tipo: "pantalla", marca: "Samsung", modelo: "A10", loteId: 1, stockInicial: stock },
    1
  );
}

function backdatearReserva(repuestoId, fechaPasada) {
  const reps = db.getArr(T.REPUESTOS);
  db.setArr(
    T.REPUESTOS,
    reps.map(r => (r.id === repuestoId ? { ...r, reservado_hasta: fechaPasada } : r))
  );
}

describe("repuestos — reservas compartidas entre órdenes (hallazgo #3)", () => {
  beforeEach(() => initDB());

  it("la expiración de la reserva de la Orden A no debe depender de la reserva posterior de la Orden B sobre el mismo repuesto", () => {
    const rep = crearRepuestoConStock(10);

    // Orden A reserva 3 unidades — su ventana ya pasó (simulado).
    reservarRepuesto(rep.id, 100, 3, 1, 1000);
    backdatearReserva(rep.id, new Date(Date.now() - 60_000).toISOString());

    // Orden B reserva 2 unidades — esto sobreescribe reservado_hasta con una
    // fecha futura, "ocultando" que la reserva de A ya expiró.
    reservarRepuesto(rep.id, 200, 2, 1, 1000);

    liberarReservasVencidas();

    const repFinal = db.getArr(T.REPUESTOS).find(r => r.id === rep.id);
    // Esperado: la reserva vencida de A (3) se liberó, solo queda la de B (2).
    expect(repFinal.stock_reservado).toBe(2);
  });
});

describe("repuestos — instalación sin verificar cantidad reservada real (hallazgo #4)", () => {
  beforeEach(() => initDB());

  it("instalarRepuesto debe rechazar una cantidad que no coincide con lo reservado para esa orden", () => {
    const rep = crearRepuestoConStock(10);

    reservarRepuesto(rep.id, 100, 3, 1, 1000); // Orden A reserva 3
    reservarRepuesto(rep.id, 200, 2, 1, 1000); // Orden B reserva 2

    // Bug del caller: intenta instalar 5 en la Orden A, cuando solo reservó 3.
    expect(() => instalarRepuesto(rep.id, 100, 5, 1)).toThrow();

    // La reserva de la Orden B (2 unidades, sin instalar) no debería verse afectada.
    const repFinal = db.getArr(T.REPUESTOS).find(r => r.id === rep.id);
    expect(repFinal.stock_reservado).toBeGreaterThanOrEqual(2);
  });
});
