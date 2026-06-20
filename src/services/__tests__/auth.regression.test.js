import { describe, it, expect, beforeEach } from "vitest";
import { initDB } from "../../db/index.js";
import { crearUsuario } from "../auth.js";

// Hallazgo #2: hashPassword usa un salt estático ("tp5salt") igual para todos
// los usuarios. Dos usuarios con la misma contraseña terminan con el MISMO
// password_hash — cualquiera con acceso a localStorage (o a un backup
// exportado) puede ver quién comparte contraseña con quién, y crackear un
// hash le da la contraseña de ambos.

describe("auth — salt de contraseña (hallazgo #2)", () => {
  beforeEach(() => initDB());

  it("dos usuarios distintos con la misma contraseña no deberían tener el mismo password_hash", async () => {
    const u1 = await crearUsuario(
      { nombre: "Usuario Uno", email: "uno@taller.test", rol: "TEC", password: "ClaveCompartida123" },
      1
    );
    const u2 = await crearUsuario(
      { nombre: "Usuario Dos", email: "dos@taller.test", rol: "TEC", password: "ClaveCompartida123" },
      1
    );

    expect(u1.password_hash).not.toBe(u2.password_hash);
  });
});
