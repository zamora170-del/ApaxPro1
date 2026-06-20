import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { initDB, db, T } from "../db/index.js";
import App from "../App.jsx";

// Hallazgo #1: App.jsx restaura la sesión confiando en el rol guardado en
// localStorage ("sesion.rol") en vez de releer el rol real del usuario en
// T.USUARIOS. Cualquiera con DevTools puede escribir una sesión con rol "ADM"
// y obtener acceso de Administrador sin contraseña.

function prepararUsuarioTecnicoConSesionFalsificadaComoADM() {
  initDB();
  db.set(T.WIZARD_DONE, true);

  // Usuario real en la base: Técnico, sin permisos de Configuración.
  db.setArr(T.USUARIOS, [{
    id: 1, email: "tecnico@taller.test", password_hash: "x",
    rol: "TEC", nombre: "Técnico de Prueba", activo: 1,
    intentos_login: 0, bloqueado_hasta: null, deleted_at: null,
    created_at: db.now(),
  }]);

  // Sesión en localStorage, manipulada a mano para reclamar rol ADM.
  db.set(T.SESSION, { id: 1, nombre: "Técnico de Prueba", email: "tecnico@taller.test", rol: "ADM", ts: Date.now() });
}

describe("App — restauración de sesión no debe confiar en el rol guardado en localStorage (hallazgo #1)", () => {
  beforeEach(() => {
    localStorage.clear();
    prepararUsuarioTecnicoConSesionFalsificadaComoADM();
  });

  it("un usuario cuyo rol real es TEC no debe ver la sección de Configuración aunque su sesión en localStorage diga rol ADM", () => {
    render(<App />);

    // "Configuración" solo aparece en el menú para rol ADM (constants.js → NAV).
    // Si la app confía en sesion.rol en vez del rol real, este texto aparecerá.
    expect(screen.queryByText("Configuración")).not.toBeInTheDocument();
  });
});
