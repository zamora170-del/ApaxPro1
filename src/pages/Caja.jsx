import { useState, useEffect } from "react";
import { Lock, Unlock, TrendingDown, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { db, T, calcularSaldoCaja } from "../db/index.js";
import { abrirCaja, cerrarCaja, registrarEgreso } from "../services/caja.js";
import { exportarCSV } from "../services/config.js";
import { PERMISOS } from "../constants.js";
import { PageHeader, Card, Button, Input, Select, Modal, DataTable, KpiCard, Badge, Alert, ConfirmDialog, fmt, fmtDate } from "../components/ui/index.jsx";
import { Banknote, DollarSign } from "lucide-react";

export default function Caja({ user }) {
  const perms = PERMISOS[user.rol] || {};
  const [caja,   setCaja]   = useState(null);
  const [movs,   setMovs]   = useState([]);
  const [modal,  setModal]  = useState(null);
  const [confirm,setConfirm]= useState(null);
  const [form,   setForm]   = useState({ concepto:"", monto:0, metodo:"efectivo" });
  const [abrirForm, setAbrirForm] = useState({ saldo_inicial:0 });
  const [error,  setError]  = useState("");

  const cargar = () => {
    const c     = db.get(T.CAJA);
    const movimientos = db.getArr(T.MOV_CAJA).sort((a,b)=>b.id-a.id);
    const usuarios    = db.getArr(T.USUARIOS);
    setCaja(c);
    setMovs(movimientos.map(m => {
      const u = usuarios.find(x => x.id === m.usuario_id);
      return { ...m, usuario_nombre: u?.nombre ?? "—" };
    }));
  };
  useEffect(cargar, []);

  const saldo     = calcularSaldoCaja();
  const ingresos  = movs.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+m.monto,0);
  const egresos   = movs.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+m.monto,0);

  const handleAbrir = () => {
    setError("");
    try {
      abrirCaja(parseFloat(abrirForm.saldo_inicial)||0, user.id);
      cargar(); setModal(null);
    } catch(e) { setError(e.message === "CAJA_YA_ABIERTA" ? "Ya hay una caja abierta." : e.message); }
  };

  const handleCerrar = () => {
    try { cerrarCaja(user.id); cargar(); setConfirm(null); }
    catch(e) { alert(e.message); }
  };

  const handleEgreso = () => {
    setError("");
    const monto = parseFloat(form.monto);
    if (!form.concepto.trim()) { setError("El concepto es obligatorio."); return; }
    if (!monto || monto <= 0) { setError("Monto inválido."); return; }
    try {
      registrarEgreso(form.concepto, monto, form.metodo, user.id);
      cargar(); setModal(null); setForm({ concepto:"", monto:0, metodo:"efectivo" });
    } catch(e) { setError(e.message === "CAJA_NO_ABIERTA" ? "La caja no está abierta." : e.message); }
  };

  const abierta = caja?.abierta ?? false;

  return (
    <div className="page-in">
      <PageHeader
        title="Caja"
        subtitle={`${caja?.fecha ?? db.today()} · ${abierta ? "🟢 Abierta" : "🔴 Cerrada"}`}
        actions={<>
          <Button variant="secondary" size="sm" onClick={()=>exportarCSV(T.MOV_CAJA)} icon={<Download size={14}/>}>CSV</Button>
          {perms.caja_abrir && !abierta && (
            <Button size="sm" onClick={()=>{setModal("abrir");setError("");}} icon={<Unlock size={14}/>}>Abrir caja</Button>
          )}
          {perms.caja_egreso && abierta && (
            <Button variant="secondary" size="sm" onClick={()=>{setModal("egreso");setError("");}} icon={<TrendingDown size={14}/>}>Registrar egreso</Button>
          )}
          {perms.caja_abrir && abierta && (
            <Button variant="danger" size="sm" onClick={()=>setConfirm(true)} icon={<Lock size={14}/>}>Cerrar caja</Button>
          )}
        </>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Saldo apertura" value={fmt(caja?.saldo_inicial??0)} icon={Banknote}      color="indigo" />
        <KpiCard title="Ingresos"       value={fmt(ingresos)}               icon={ArrowUpRight}  color="green" />
        <KpiCard title="Egresos"        value={fmt(egresos)}                icon={ArrowDownRight}color="red" />
        <KpiCard title="Saldo actual"   value={fmt(saldo)}                  icon={DollarSign}    color="amber" />
      </div>

      {/* Tabla movimientos */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Movimientos del día</h3>
          <p className="text-xs text-slate-500 mt-0.5">Fuente de verdad contable · Registros inmutables [VAL-04]</p>
        </div>
        <DataTable
          columns={[
            { key:"created_at",     label:"Hora",   render:v=>new Date(v).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"}) },
            { key:"tipo",           label:"Tipo",   render:v=><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${v==="ingreso"?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700"}`}>{v==="ingreso"?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>}{v}</span> },
            { key:"monto",          label:"Monto",  render:(v,r)=><span className={`font-bold text-base ${r.tipo==="ingreso"?"text-emerald-700":"text-red-700"}`}>{r.tipo==="ingreso"?"+":"−"}{fmt(v)}</span> },
            { key:"concepto",       label:"Concepto" },
            { key:"metodo",         label:"Método", render:v=><Badge className="bg-slate-100 text-slate-600 capitalize">{v}</Badge> },
            { key:"usuario_nombre", label:"Registrado por" },
          ]}
          data={movs}
          emptyText="Sin movimientos. La caja se inicia al abrir."
        />
        {movs.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end items-center gap-6">
            <span className="text-sm text-slate-500">Balance del día</span>
            <span className={`text-xl font-black ${saldo>=(caja?.saldo_inicial??0)?"text-emerald-700":"text-red-700"}`}>{fmt(saldo)}</span>
          </div>
        )}
      </Card>

      {/* ─── MODAL ABRIR CAJA ──────────────────────────────────────────────── */}
      {modal === "abrir" && (
        <Modal title="Abrir caja del día" onClose={()=>setModal(null)} size="sm"
          footer={<><Button variant="secondary" onClick={()=>setModal(null)}>Cancelar</Button><Button onClick={handleAbrir} icon={<Unlock size={14}/>}>Abrir</Button></>}>
          <p className="text-sm text-slate-500 mb-4">Ingresa el efectivo inicial en caja para comenzar la jornada.</p>
          <Input label="Saldo inicial ($)" value={abrirForm.saldo_inicial} onChange={v=>setAbrirForm({saldo_inicial:v})} type="number" hint="Puede ser 0 si no hay efectivo físico." />
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {/* ─── MODAL EGRESO ──────────────────────────────────────────────────── */}
      {modal === "egreso" && (
        <Modal title="Registrar egreso de caja" onClose={()=>setModal(null)} size="sm"
          footer={<><Button variant="secondary" onClick={()=>setModal(null)}>Cancelar</Button><Button variant="danger" onClick={handleEgreso} icon={<TrendingDown size={14}/>}>Registrar egreso</Button></>}>
          <div className="space-y-3">
            <Input label="Concepto *" value={form.concepto} onChange={v=>setForm(p=>({...p,concepto:v}))} placeholder="Compra repuestos, gasto operativo…" required />
            <Input label="Monto ($) *" value={form.monto} onChange={v=>setForm(p=>({...p,monto:v}))} type="number" required />
            <Select label="Método" value={form.metodo} onChange={v=>setForm(p=>({...p,metodo:v}))}
              options={[{value:"efectivo",label:"Efectivo"},{value:"tarjeta",label:"Tarjeta"},{value:"transferencia",label:"Transferencia"},{value:"otros",label:"Otros"}]} />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {/* ─── CONFIRMAR CIERRE ──────────────────────────────────────────────── */}
      {confirm && (
        <ConfirmDialog
          title="Cerrar caja"
          message={`El saldo final quedará registrado como ${fmt(saldo)}. Esta operación no puede revertirse.`}
          onConfirm={handleCerrar}
          onCancel={()=>setConfirm(null)}
          confirmLabel="Confirmar cierre"
        />
      )}
    </div>
  );
}
