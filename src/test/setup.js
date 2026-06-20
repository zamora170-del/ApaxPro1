import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Cada test arranca con localStorage limpio — evita que el estado de un test
// (usuarios, ordenes, repuestos creados) contamine el siguiente.
afterEach(() => {
  localStorage.clear();
});
