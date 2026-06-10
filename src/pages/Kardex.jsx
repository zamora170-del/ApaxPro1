import { useState, useEffect } from "react";
import { Shield, Download } from "lucide-react";
import { db, T } from "../db/index.js";
import { exportarCSV } from "../services/config.js";
import { KARDEX_LABEL, KARDEX_COLOR, KARDEX_SIGNO, KARDEX_TIPOS } from "../constants.js";
import { PageHeader, Card, Badge, DataTable, SearchInput, Alert, KpiCard, fmtDate } from "../components/ui/index.jsx";
import { BookOpen, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function Kardex({ user }) {
  const [movs,       setMovs]       = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [search,     setSearch]     = useState("");

  const cargar = () => {
    const kardex    = db.getArr(T.KARDEX).sort((a,b) => b.id - a.id);
    const repuestos = db.getArr(T.REPUESTOS);
    const usuarios  = db.getArr(T.USUARIOS);
    setMovs(kardex.map(k => {
      const r = repuestos.find(x => x.id === k.repuesto_id);
      const u = usuarios.find(x => x.id === k.usuario_id);
      return {
        ...k,
        repuesto_codigo: r?.codigo_interno ?? "—",
        repuesto_desc:   r ? `${r.tipo} ${r.marca} ${r.modelo}` : "Eliminado",
        usuario_nombre:  u?.nombre ?? "—",
      };
    }));
  };
  useEffect(cargar, []);

  const filtered = movs.filter(m => {
    const matchTipo   = filtroTipo === "todos" || m.tipo === filtroTipo;
    const matchSearch = m.repuesto_codigo.toLowerCase().includes(search.toLowerCase()) ||
      m.repuesto_desc.toLowerCase().includes(search.toLowerCase()) ||
      (m.motivo ?? "").toLowerCase().includes(search.toLowerCase());
    return matchTipo && matchSearch;
  });

  const entradas = movs.filter(m => ["entrada","ajuste_entrada"].includes(m.tipo)).reduce((s,m)=>s+m.cantidad,0);
  const salidas  = movs.filter(m => ["salida","ajuste_salida","perdida"].includes(m.tipo)).reduce((s,m)=>s+m.cantidad,0);

  return (
    <div className="page-in">
      <PageHeader title="Kardex de Inventario" subtitle="Fuente de verdad · Registros inmutables [VAL-02]"
        actions={<>
          <button onClick={() => exportarCSV(T.KARDEX)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition">
            <Download size={14} /> CSV
          </button>
        </>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total movimientos" value={movs.length}   icon={BookOpen}       color="indigo" />
        <KpiCard title="Entradas totales"  value={entradas}      icon={ArrowUpRight}   color="green" />
        <KpiCard title="Salidas totales"   value={salidas}       icon={ArrowDownRight} color="red" />
        <KpiCard title="Pérdidas"          value={movs.filter(m=>m.tipo==="perdida").length} icon={Shield} color="amber" />
      </div>

      {/* Alerta inmutabilidad */}
      <Alert type="info" className="mb-4">
        <Shield size={14} className="inline mr-1" />
        Los movimientos de kardex son <strong>inmutables</strong> (triggers [VAL-02]). Para corregir errores use <strong>ajuste_entrada</strong> o <strong>ajuste_salida</strong> con motivo obligatorio desde Inventario.
      </Alert>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {["todos", ...KARDEX_TIPOS].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition
              ${filtroTipo === t ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {t === "todos" ? `Todos (${movs.length})` : `${KARDEX_LABEL[t]} (${movs.filter(m=>m.tipo===t).length})`}
          </button>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-slate-200">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código, descripción, motivo…" className="max-w-sm" />
        </div>
        <DataTable
          columns={[
            { key:"tipo",          label:"Tipo",      render:v=><Badge className={KARDEX_COLOR[v]}>{KARDEX_LABEL[v]}</Badge> },
            { key:"repuesto_codigo",label:"Código",   render:v=><span className="font-mono text-xs font-bold text-indigo-700">{v}</span> },
            { key:"repuesto_desc", label:"Repuesto" },
            { key:"cantidad",      label:"Cantidad",  render:(v,r)=><span className={`font-bold font-mono text-sm ${["entrada","ajuste_entrada"].includes(r.tipo)?"text-emerald-600":"text-red-600"}`}>{KARDEX_SIGNO[r.tipo]}{v}</span> },
            { key:"motivo",        label:"Motivo",    render:v=>v||<span className="text-slate-300">—</span> },
            { key:"usuario_nombre",label:"Usuario" },
            { key:"created_at",    label:"Fecha",     render:v=>fmtDate(v) },
          ]}
          data={filtered}
          emptyText="Sin movimientos registrados."
        />
      </Card>
    </div>
  );
}
