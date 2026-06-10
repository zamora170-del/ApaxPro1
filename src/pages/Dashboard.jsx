import { useState, useEffect, useCallback } from "react";
import { ClipboardList, CheckCircle, TrendingUp, DollarSign, AlertTriangle, Package, Clock, ArrowUpRight } from "lucide-react";
import { db, T, calcularSaldoCaja, calcularTotalOrden, calcularPagadoOrden } from "../db/index.js";
import { ESTADOS, ESTADO_LABEL, ESTADO_COLOR, PERMISOS } from "../constants.js";
import { PageHeader, KpiCard, Card, Badge, Alert, fmt, fmtDate } from "../components/ui/index.jsx";

export default function Dashboard({ user }) {
  const [stats, setStats] = useState(null);
  const perms = PERMISOS[user.rol] || {};

  const cargar = useCallback(() => {
    const ordenes   = db.getArr(T.ORDENES).filter(o => !o.deleted_at);
    const repuestos = db.getArr(T.REPUESTOS).filter(r => !r.deleted_at);
    const clientes  = db.getArr(T.CLIENTES).filter(c => !c.deleted_at);
    const cfg       = db.get(T.CONFIG) || {};
    const stockMin  = parseFloat(cfg.stock_minimo_global?.valor ?? "2");

    const activas   = ordenes.filter(o => !["entregado","anulado"].includes(o.estado));
    const listas    = ordenes.filter(o => o.estado === "listo");
    const stockBajo = repuestos.filter(r => (r.stock - r.stock_reservado) <= stockMin);

    const saldo        = calcularSaldoCaja();
    const movsCaja     = db.getArr(T.MOV_CAJA);
    const ingresosMes  = movsCaja.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);

    const porEstado = {};
    ESTADOS.forEach(e => { porEstado[e] = ordenes.filter(o => o.estado === e).length; });

    const clientesMap = Object.fromEntries(clientes.map(c => [c.id, c.nombre]));
    const recientes = ordenes.slice(-6).reverse().map(o => ({
      ...o,
      cliente_nombre: clientesMap[o.cliente_id] ?? "—",
      total:  calcularTotalOrden(o.id),
      pagado: calcularPagadoOrden(o.id),
    }));

    // Órdenes con tiempo excesivo (>48h sin avance — alerta operativa)
    const ahora   = Date.now();
    const vencidas = activas.filter(o => {
      const ingreso = new Date(o.fecha_ingreso).getTime();
      return (ahora - ingreso) > 48 * 3_600_000 && o.estado !== "listo";
    });

    setStats({ activas:activas.length, listas:listas.length, stockBajo, saldo, ingresosMes, porEstado, recientes, vencidas, total:ordenes.length });
  }, []);

  useEffect(() => { cargar(); const t = setInterval(cargar, 30_000); return () => clearInterval(t); }, [cargar]);

  if (!stats) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full spin" /></div>;

  const { activas, listas, stockBajo, saldo, ingresosMes, porEstado, recientes, vencidas } = stats;

  return (
    <div className="page-in">
      <PageHeader
        title={`Buenos días, ${user.nombre.split(" ")[0]} 👋`}
        subtitle={`Resumen operativo · ${new Date().toLocaleDateString("es-CO",{ weekday:"long", day:"numeric", month:"long", year:"numeric" })}`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Órdenes activas"  value={activas}           sub="En proceso"         icon={ClipboardList} color="indigo" />
        <KpiCard title="Equipos listos"   value={listas}            sub="Esperando entrega"  icon={CheckCircle}   color="green" />
        {perms.dashboard_fin && <>
          <KpiCard title="Ingresos acumulados" value={fmt(ingresosMes)}  sub="Pagos registrados"  icon={TrendingUp}    color="amber" />
          <KpiCard title="Saldo en caja"        value={fmt(saldo)}       sub="Saldo actual"        icon={DollarSign}    color="purple" />
        </>}
        {!perms.dashboard_fin && <>
          <KpiCard title="Stock bajo mínimo" value={stockBajo.length} sub="Requieren reorden"   icon={AlertTriangle} color="red" />
          <KpiCard title="Total órdenes"      value={stats.total}      sub="Historial completo"  icon={Package}       color="teal" />
        </>}
      </div>

      {/* Alertas operativas */}
      {vencidas.length > 0 && (
        <Alert type="warning" className="mb-4">
          <strong>{vencidas.length} orden(es) llevan más de 48h sin avance.</strong>{" "}
          {vencidas.slice(0,3).map(o => o.numero_orden).join(", ")}
          {vencidas.length > 3 ? ` y ${vencidas.length - 3} más.` : "."}
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Órdenes por estado */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Órdenes por estado</h3>
          <div className="space-y-2.5">
            {ESTADOS.slice(0, -1).map(e => {
              const count = porEstado[e] || 0;
              const total = Object.values(porEstado).reduce((a,b)=>a+b,0) || 1;
              return (
                <div key={e} className="flex items-center gap-3">
                  <Badge className={`w-36 justify-center text-xs ${ESTADO_COLOR[e]}`}>{ESTADO_LABEL[e]}</Badge>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width:`${(count/total)*100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Últimas órdenes */}
        <Card className="p-5">
          <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">Últimas órdenes</h3>
          <div className="space-y-3">
            {!recientes.length && <p className="text-sm text-slate-400">Sin órdenes aún.</p>}
            {recientes.map(o => (
              <div key={o.id} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 text-indigo-600 text-xs font-bold">
                  {o.equipo_marca?.[0] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{o.numero_orden}</p>
                  <p className="text-xs text-slate-500 truncate">{o.equipo_marca} {o.equipo_modelo}</p>
                </div>
                <Badge className={`${ESTADO_COLOR[o.estado]} text-[10px]`}>{ESTADO_LABEL[o.estado]}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alertas stock */}
      {stockBajo.length > 0 && (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="font-bold text-amber-800 text-sm">Stock bajo mínimo — {stockBajo.length} repuesto(s)</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {stockBajo.slice(0,8).map(r => (
              <div key={r.id} className="bg-white rounded-lg px-3 py-2 border border-amber-200">
                <p className="text-xs font-bold text-slate-800">{r.codigo_interno}</p>
                <p className="text-xs text-slate-500 truncate">{r.tipo} {r.marca} {r.modelo}</p>
                <p className="text-xs font-bold text-amber-700 mt-0.5">Disponible: {r.stock - r.stock_reservado}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
