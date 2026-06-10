# TallerPro v5.0 — PWA para Vercel

Sistema de gestión para talleres de reparación de celulares.  
**Offline-first · 100% local · Sin backend · Sin servidor.**

## Despliegue en Vercel

### Opción A — Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

### Opción B — GitHub + Vercel Dashboard
1. Sube a GitHub
2. Vercel → New Project → Import
3. Framework: **Vite** · Build: `npm run build` · Output: `dist`
4. Deploy

## Desarrollo local
```bash
npm install
npm run dev
```

## Primer inicio
Al abrir por primera vez aparece el **Wizard de configuración**:
1. Datos del taller
2. Crear usuario Administrador
3. Apariencia (opcional)

## Módulos
| Módulo | Roles |
|--------|-------|
| Dashboard | Todos |
| Clientes | Todos |
| Órdenes | Todos |
| Inventario | Todos |
| Kardex | Todos |
| Caja | ADM, CON |
| Reportes | Todos |
| Configuración | Solo ADM |

## Arquitectura
- **DB**: localStorage (espejo fiel del schema SQLite — 16 tablas)
- **Auth**: SHA-256 Web Crypto API, bloqueo por intentos
- **FIFO**: selección por lote más antiguo con stock disponible (sección 6.1)
- **Kardex**: inmutable — solo INSERT, nunca UPDATE/DELETE (VAL-02)
- **Caja**: movimientos_caja como fuente de verdad (VAL-04)
- **Audit**: insertAuditLog() tipado en cada acción (VAL-07)
- **Reservas**: stock_reservado como campo real (VAL-03), liberación cada 5 min
- **PWA**: Service Worker offline-first, manifest.json

## Stack
React 18 · Vite 5 · TailwindCSS 3 · Lucide React · Vercel
