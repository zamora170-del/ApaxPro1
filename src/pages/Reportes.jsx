import { useState } from "react";
import { Download, TrendingUp, TrendingDown, DollarSign, ClipboardList, CheckCircle, XCircle, Clock, Shield, Activity } from "lucide-react";
import { db, T, calcularTotalOrden, calcularPagadoOrden } from "../db/index.js";
import { exportarCSV } from "../services/config.js";
import { PERMISOS, ESTADO_LABEL, ESTADO_COLOR, KARDEX_LABEL, KARDEX_COLOR } from "../constants.js";
import { PageHeader, Card, KpiCard, DataTable, Badge, Tabs, Alert, fmt, fmtDate, fmtDateTime } from "../components/ui/index.jsx";

function buildStats() {
  const ordenes    = db.getArr(T.ORDENES).filter(o => !o.deleted_at);
  const repuestos  = db.getArr(T.REPUESTOS).filter(r => !r.deleted_at);
  const kardex     = db.getArr(T.KARDEX);
  const movsCaja   = db.getArr(T.MOV_CAJA);
  const pagos      = db.getArr(T.PAGOS);
  const clientes   = db.getArr(T.CLIENTES).filter(c => !c.deleted_at);
  const usuarios   = db.getArr(T.USUARIOS);
  const audit      = db.getArr(T.AUDIT).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

  const totalIngresos = movsCaja.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+m.monto,0);
  const totalEgresos  = movsCaja.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+m.monto,0);

  // Top repuestos por salidas en kardex
  const salidas = kardex.filter(k=>k.tipo==="salida");
  const topRepMap = {};
  salidas.forEach(k => { topRepMap[k.repuesto_id] = (topRepMap[k.repuesto_id]||0)+k.cantidad; });
  const topRep = Object.entries(topRepMap).map(([id,cant]) => {
    const r = repuestos.find(x=>x.id===parseInt(id));
    return { codigo: r?.codigo_interno??"—", desc: r?`${r.tipo} ${r.marca} ${r.modelo}`:"Eliminado", instalaciones: cant };
  }).sort((a,b)=>b.instalaciones-a.instalaciones).slice(0,8);

  // Ingresos por método
  const porMetodo = {};
  movsCaja.filter(m=>m.tipo==="ingreso").forEach(m=>{
    porMetodo[m.metodo] = (porMetodo[m.metodo]||0)+m.monto;
  });

  // Rendimiento por técnico
  const tecnicosMap = {};
  ordenes.filter(o=>o.tecnico_id).forEach(o => {
    const id = o.tecnico_id;
    if (!tecnicosMap[id]) tecnicosMap[id] = { asignadas:0, entregadas:0, anuladas:0 };
    tecnicosMap[id].asignadas++;
    if (o.estado==="entregado") tecnicosMap[id].entregadas++;
    if (o.estado==="anulado")   tecnicosMap[id].anuladas++;
  });
  const tecnicosList = Object.entries(tecnicosMap).map(([id,d]) => {
    const u = usuarios.find(x=>x.id===parseInt(id));
    return { nombre: u?.nombre??"—", ...d, tasa: d.asignadas>0?Math.round((d.entregadas/d.asignadas)*100):0 };
  }).sort((a,b)=>b.asignadas-a.asignadas);

  // Órdenes enriquecidas
  const clienteMap = Object.fromEntries(clientes.map(c=>[c.id,c.nombre]));
  const ordenesEnrich = ordenes.map(o=>({...o, cliente_nombre:clienteMap[o.cliente_id]??"—", total:calcularTotalOrden(o.id), pagado:calcularPagadoOrden(o.id)}));

  // Audit enriquecido
  const auditEnrich = audit.slice(0,100).map(a=>{
    const u = usuarios.find(x=>x.id===a.usuario_id);
    return { ...a, usuario_nombre: u?.nombre??"Sistema" };
  });

  // Stock bajo mínimo
  const cfg = db.get(T.CONFIG)||{};
  const stockMin = parseFloat(cfg.stock_minimo_global?.valor??"2");
  const stockBajo = repuestos.filter(r=>(r.stock-r.stock_reservado)<=stockMin);

  return { totalIngresos, totalEgresos, ordenes: ordenesEnrich, topRep, porMetodo, tecnicosList, auditEnrich, stockBajo, kardex };
}

export default function Reportes({ user }) {
  const perms = PERMISOS[user.rol] || {};
  const [tab, setTab] = useState(perms.reportes_financieros ? "financiero" : "operativo");
  const s = buildStats();

  const TABS = [
    perms.reportes_financieros && { id:"financiero", label:"Financiero",   icon:DollarSign },
    { id:"operativo",  label:"Operativo",    icon:Activity },
    perms.reportes_auditoria  && { id:"auditoria",  label:"Auditoría",    icon:Shield },
  ].filter(Boolean);

  return (
    <div className="page-in">
      <PageHeader title="Reportes" subtitle="Datos en tiempo real"
        actions={<>
          <button onClick={()=>exportarCSV(T.ORDENES)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition"><Download size={13}/>Órdenes CSV</button>
          {perms.reportes_financieros && <button onClick={()=>exportarCSV(T.MOV_CAJA)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition"><Download size={13}/>Caja CSV</button>}
          {perms.reportes_auditoria   && <button onClick={()=>exportarCSV(T.AUDIT)}    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition"><Download size={13}/>Audit CSV</button>}
        </>}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ─── FINANCIERO ─────────────────────────────────────────────────────── */}
      {tab === "financiero" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <KpiCard title="Ingresos totales" value={fmt(s.totalIngresos)} icon={TrendingUp}   color="green" />
            <KpiCard title="Egresos totales"  value={fmt(s.totalEgresos)}  icon={TrendingDown} color="red" />
            <KpiCard title="Saldo neto"        value={fmt(s.totalIngresos-s.totalEgresos)} icon={DollarSign} color="indigo" />
          </div>

          {/* Ingresos por método */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-800 mb-4">Ingresos por método de pago</h3>
            {Object.keys(s.porMetodo).length === 0
              ? <p className="text-slate-400 text-sm">Sin ingresos registrados.</p>
              : ["efectivo","transferencia","tarjeta","otros"].map(m => {
                  const val = s.porMetodo[m] || 0;
                  const pct = s.totalIngresos > 0 ? (val/s.totalIngresos)*100 : 0;
                  return (
                    <div key={m} className="flex items-center gap-3 mb-3">
                      <span className="w-28 text-sm text-slate-600 capitalize">{m}</span>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{width:`${pct}%`}} />
                      </div>
                      <span className="text-sm font-bold text-slate-800 w-28 text-right">{fmt(val)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })
            }
          </Card>

          {/* Top repuestos */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-800 mb-4">Top repuestos instalados</h3>
            <DataTable
              columns={[
                { key:"codigo",        label:"Código",       render:v=><span className="font-mono text-xs font-bold text-indigo-700">{v}</span> },
                { key:"desc",          label:"Descripción" },
                { key:"instalaciones", label:"Instalaciones",render:v=><Badge className="bg-indigo-100 text-indigo-700">{v}</Badge> },
              ]}
              data={s.topRep}
              emptyText="Sin instalaciones registradas."
            />
          </Card>

          {/* Lista de compras sugerida */}
          {s.stockBajo.length > 0 && (
            <Card className="p-5">
              <h3 className="font-bold text-slate-800 mb-4">Lista de compras sugerida (stock ≤ mínimo)</h3>
              {s.stockBajo.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{r.tipo} {r.marca} {r.modelo}</p>
                    <p className="text-xs text-slate-500">{r.codigo_interno} · Disponible: {r.stock - r.stock_reservado}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Sugerido</p>
                    <p className="font-bold text-red-700">5 unidades</p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ─── OPERATIVO ──────────────────────────────────────────────────────── */}
      {tab === "operativo" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total órdenes"  value={s.ordenes.length}                                      icon={ClipboardList} color="indigo" />
            <KpiCard title="Entregadas"     value={s.ordenes.filter(o=>o.estado==="entregado").length}    icon={CheckCircle}   color="green" />
            <KpiCard title="En proceso"     value={s.ordenes.filter(o=>!["entregado","anulado"].includes(o.estado)).length} icon={Clock} color="amber" />
            <KpiCard title="Anuladas"       value={s.ordenes.filter(o=>o.estado==="anulado").length}      icon={XCircle}       color="red" />
          </div>

          {/* Rendimiento por técnico */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-800 mb-4">Rendimiento por técnico</h3>
            {!s.tecnicosList.length
              ? <p className="text-slate-400 text-sm">Sin órdenes asignadas a técnicos.</p>
              : <DataTable
                  columns={[
                    { key:"nombre",     label:"Técnico",      render:v=><span className="font-semibold">{v}</span> },
                    { key:"asignadas",  label:"Asignadas" },
                    { key:"entregadas", label:"Entregadas" },
                    { key:"anuladas",   label:"Anuladas" },
                    { key:"tasa",       label:"Tasa cierre",  render:v=><Badge className={v>=70?"bg-green-100 text-green-700":v>=40?"bg-amber-100 text-amber-700":"bg-red-100 text-red-700"}>{v}%</Badge> },
                  ]}
                  data={s.tecnicosList}
                />
            }
          </Card>

          {/* Últimas órdenes */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-800 mb-4">Órdenes recientes</h3>
            <DataTable
              columns={[
                { key:"numero_orden",  label:"Orden",    render:v=><span className="font-mono text-xs font-bold text-indigo-700">{v}</span> },
                { key:"cliente_nombre",label:"Cliente" },
                { key:"equipo_marca",  label:"Equipo",   render:(v,r)=>`${v} ${r.equipo_modelo}` },
                { key:"estado",        label:"Estado",   render:v=><Badge className={ESTADO_COLOR[v]}>{ESTADO_LABEL[v]}</Badge> },
                { key:"total",         label:"Total",    render:v=>fmt(v) },
                { key:"pagado",        label:"Pagado",   render:(v,r)=><span className={v>=r.total&&r.total>0?"text-emerald-600 font-semibold":"text-amber-600 font-semibold"}>{fmt(v)}</span> },
                { key:"fecha_ingreso", label:"Ingreso",  render:v=>fmtDate(v) },
              ]}
              data={s.ordenes.slice(0,20)}
            />
          </Card>
        </div>
      )}

      {/* ─── AUDITORÍA ──────────────────────────────────────────────────────── */}
      {tab === "auditoria" && (
        <Card>
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">Log de auditoría</h3>
            <p className="text-xs text-slate-500 mt-0.5">Últimas 100 acciones · Generado por insertAuditLog() [VAL-07]</p>
          </div>
          <DataTable
            columns={[
              { key:"fecha",          label:"Fecha/Hora",  render:v=>fmtDateTime(v) },
              { key:"usuario_nombre", label:"Usuario",     render:v=><span className="font-semibold">{v}</span> },
              { key:"accion",         label:"Acción",      render:v=>{
                const c={LOGIN:"bg-blue-100 text-blue-700",LOGIN_FALLIDO:"bg-red-100 text-red-700",CREATE:"bg-emerald-100 text-emerald-700",UPDATE:"bg-amber-100 text-amber-700",DELETE:"bg-red-100 text-red-700",BACKUP:"bg-purple-100 text-purple-700",RESTORE:"bg-purple-100 text-purple-700",CONFIG_CHANGE:"bg-slate-100 text-slate-700",LOGOUT:"bg-slate-100 text-slate-500"};
                return <Badge className={c[v]||"bg-slate-100 text-slate-600"}>{v}</Badge>;
              }},
              { key:"entidad",        label:"Entidad",     render:v=><span className="text-slate-500 text-xs">{v}</span> },
            ]}
            data={s.auditEnrich}
            emptyText="Sin registros de auditoría."
          />
        </Card>
      )}
    </div>
  );
}
