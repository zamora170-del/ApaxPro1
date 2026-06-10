import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronRight, Check, XCircle, CreditCard, Search as SearchIcon, Package } from "lucide-react";
import { db, T, calcularTotalOrden, calcularPagadoOrden, getCfg } from "../db/index.js";
import { crearOrden, avanzarEstado, anularOrden, actualizarOrden, quitarRepuestoDeOrden } from "../services/ordenes.js";
import { seleccionarFIFO, reservarRepuesto, instalarRepuesto } from "../services/repuestos.js";
import { registrarPago } from "../services/caja.js";
import { ESTADOS, TRANSICIONES, ESTADO_LABEL, ESTADO_COLOR, PERMISOS } from "../constants.js";
import { PageHeader, Card, Button, Input, Select, Textarea, Modal, DataTable, SearchInput, Badge, Alert, ConfirmDialog, fmt, fmtDate } from "../components/ui/index.jsx";

// ─── Helper: enriquecer orden ─────────────────────────────────────────────────
function enriquecer(o, clientes) {
  const cli = clientes.find(c => c.id === o.cliente_id);
  return { ...o, cliente_nombre: cli?.nombre ?? "—", total: calcularTotalOrden(o.id), pagado: calcularPagadoOrden(o.id) };
}

export default function Ordenes({ user }) {
  const perms = PERMISOS[user.rol] || {};
  const [ordenes,  setOrdenes]  = useState([]);
  const [filtro,   setFiltro]   = useState("todos");
  const [search,   setSearch]   = useState("");
  const [detalle,  setDetalle]  = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [pagoModal,setPagoModal]= useState(false);
  const [repModal, setRepModal] = useState(false);
  const [error,    setError]    = useState("");

  // Formulario nueva orden
  const [form, setForm] = useState({ cliente_id:"", equipo_marca:"", equipo_modelo:"", imei:"", falla_reportada:"", tecnico_id:"", prioridad:"normal", valor_mano_obra:0, descuento:0 });
  const setF = f => setForm(p=>({...p,...f}));

  // Formulario repuesto FIFO
  const [busRep, setBusRep]   = useState({ tipo:"", marca:"", modelo:"" });
  const setBR = f => setBusRep(p=>({...p,...f}));
  const [repResult,setRepResult] = useState(null);
  const [repError, setRepError]  = useState("");

  // Formulario pago
  const [pagoForm,setPagoForm] = useState({ monto:0, metodo:"efectivo", notas:"" });
  const setPF = f => setPagoForm(p=>({...p,...f}));

  const cargar = useCallback(() => {
    const clientes = db.getArr(T.CLIENTES);
    let ords = db.getArr(T.ORDENES).filter(o => !o.deleted_at);
    // TEC solo ve sus órdenes asignadas
    if (user.rol === "TEC") ords = ords.filter(o => o.tecnico_id === user.id);
    setOrdenes(ords.map(o => enriquecer(o, clientes)).reverse());
  }, [user]);

  useEffect(() => { cargar(); }, [cargar]);

  const recargarDetalle = useCallback(id => {
    const clientes = db.getArr(T.CLIENTES);
    const o = db.getArr(T.ORDENES).find(x => x.id === id);
    if (!o) return;
    const oreps     = db.getArr(T.ORDEN_REPUESTOS).filter(r => r.orden_id === id);
    const repuestos = db.getArr(T.REPUESTOS);
    const pagos     = db.getArr(T.PAGOS).filter(p => p.orden_id === id);
    const orepsRich = oreps.map(r => {
      const rp = repuestos.find(x => x.id === r.repuesto_id);
      return { ...r, codigo: rp?.codigo_interno ?? "—", desc: rp ? `${rp.tipo} ${rp.marca} ${rp.modelo}` : "—" };
    });
    setDetalle({ ...enriquecer(o, clientes), oreps: orepsRich, pagos });
  }, []);

  const filtered = ordenes.filter(o => {
    const matchFiltro = filtro === "todos" || o.estado === filtro;
    const matchSearch = o.numero_orden.includes(search) || o.cliente_nombre.toLowerCase().includes(search.toLowerCase()) || (o.equipo_marca+"").toLowerCase().includes(search.toLowerCase()) || (o.imei??"").includes(search);
    return matchFiltro && matchSearch;
  });

  const clientes = db.getArr(T.CLIENTES).filter(c => !c.deleted_at);
  const tecnicos = db.getArr(T.USUARIOS).filter(u => u.activo && ["TEC","ADM"].includes(u.rol));

  // ─── Acciones ───────────────────────────────────────────────────────────────
  const handleCrear = () => {
    if (!form.cliente_id) { setError("Selecciona un cliente."); return; }
    if (!form.equipo_marca.trim() || !form.equipo_modelo.trim()) { setError("Marca y modelo son requeridos."); return; }
    try {
      crearOrden({ clienteId: parseInt(form.cliente_id), equipoMarca: form.equipo_marca, equipoModelo: form.equipo_modelo, imei: form.imei, fallaReportada: form.falla_reportada, tecnicoId: form.tecnico_id ? parseInt(form.tecnico_id) : null, prioridad: form.prioridad, valorManoObra: form.valor_mano_obra, descuento: form.descuento }, user.id);
      cargar(); setNewModal(false); setError("");
      setForm({ cliente_id:"", equipo_marca:"", equipo_modelo:"", imei:"", falla_reportada:"", tecnico_id:"", prioridad:"normal", valor_mano_obra:0, descuento:0 });
    } catch (e) { setError(e.message === "IMEI_INVALIDO" ? "IMEI debe tener 14-16 dígitos." : e.message); }
  };

  const handleAvanzar = (orden, nuevoEstado) => {
    try { avanzarEstado(orden.id, nuevoEstado, null, user.id); cargar(); recargarDetalle(orden.id); }
    catch (e) { alert(e.message.startsWith("SALDO_PENDIENTE:") ? `Saldo pendiente: ${fmt(parseFloat(e.message.split(":")[1]))}. Solo el ADM puede entregar con deuda.` : e.message); }
  };

  const handleAnular = orden => {
    const motivo = prompt("Motivo de anulación (obligatorio):");
    if (!motivo?.trim()) return;
    try { anularOrden(orden.id, motivo, user.id); cargar(); setDetalle(null); }
    catch (e) { alert(e.message); }
  };

  const handleBuscarRep = () => {
    setRepError("");
    if (!busRep.tipo || !busRep.marca || !busRep.modelo) { setRepError("Completa tipo, marca y modelo."); return; }
    const r = seleccionarFIFO(busRep.tipo, busRep.marca, busRep.modelo, 1);
    if (!r) { setRepError("Sin stock disponible para esa combinación."); setRepResult(null); }
    else setRepResult(r);
  };

  const handleAsignarRep = () => {
    if (!repResult || !detalle) return;
    const factor       = getCfg("factor_instalacion", 1.5);
    const valorUnitario = repResult.costo_unitario * factor;
    try {
      reservarRepuesto(repResult.id, detalle.id, 1, user.id, valorUnitario);
      cargar(); recargarDetalle(detalle.id);
      setRepModal(false); setBusRep({ tipo:"", marca:"", modelo:"" }); setRepResult(null); setRepError("");
    } catch (e) { setRepError(e.message === "STOCK_INSUFICIENTE" ? "Sin stock disponible." : e.message); }
  };

  const handleInstalar = (orep) => {
    try { instalarRepuesto(orep.repuesto_id, detalle.id, orep.cantidad, user.id); cargar(); recargarDetalle(detalle.id); }
    catch (e) { alert(e.message); }
  };

  const handleQuitarRep = (orep) => {
    try { quitarRepuestoDeOrden(detalle.id, orep.repuesto_id, user.id); cargar(); recargarDetalle(detalle.id); }
    catch (e) { alert(e.message); }
  };

  const handlePago = () => {
    const monto = parseFloat(pagoForm.monto);
    if (!monto || monto <= 0) { alert("Monto inválido."); return; }
    const pendiente = (detalle?.total ?? 0) - (detalle?.pagado ?? 0);
    if (monto > pendiente + 0.01) { alert(`El monto supera el saldo pendiente de ${fmt(pendiente)}.`); return; }
    try {
      registrarPago(detalle.id, monto, pagoForm.metodo, pagoForm.notas, user.id);
      cargar(); recargarDetalle(detalle.id); setPagoModal(false); setPagoForm({ monto:0, metodo:"efectivo", notas:"" });
    } catch (e) { alert(e.message === "CAJA_NO_ABIERTA" ? "La caja no está abierta. Ábrela desde el módulo Caja." : e.message); }
  };

  const conteoFiltro = e => ordenes.filter(o => o.estado === e).length;

  return (
    <div className="page-in">
      <PageHeader title="Órdenes de Reparación" subtitle={`${filtered.length} de ${ordenes.length} órdenes`}
        actions={perms.ordenes_crear && <Button onClick={() => { setNewModal(true); setError(""); }} icon={<Plus size={16}/>}>Nueva orden</Button>}
      />

      {/* Filtros estado */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {["todos", ...ESTADOS].map(e => (
          <button key={e} onClick={() => setFiltro(e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtro===e ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {e === "todos" ? "Todos" : ESTADO_LABEL[e]}
            <span className="ml-1 opacity-70">{e==="todos" ? ordenes.length : conteoFiltro(e)}</span>
          </button>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-slate-200">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar orden, cliente, equipo, IMEI..." className="max-w-sm" />
        </div>
        <DataTable onRowClick={o => recargarDetalle(o.id)}
          columns={[
            { key:"numero_orden",  label:"N° Orden",  render:v=><span className="font-mono text-xs font-bold text-indigo-700">{v}</span> },
            { key:"cliente_nombre",label:"Cliente" },
            { key:"equipo_marca",  label:"Equipo",    render:(v,r)=>`${v} ${r.equipo_modelo}` },
            { key:"estado",        label:"Estado",    render:v=><Badge className={ESTADO_COLOR[v]}>{ESTADO_LABEL[v]}</Badge> },
            { key:"prioridad",     label:"Prioridad", render:v=>v!=="normal"?<Badge className={v==="urgente"?"bg-orange-100 text-orange-700":"bg-violet-100 text-violet-700"}>{v}</Badge>:null },
            { key:"total",         label:"Total",     render:v=>v>0?<span className="font-semibold">{fmt(v)}</span>:"—" },
            { key:"pagado",        label:"Pagado",    render:(v,r)=>r.total>0?<span className={v>=r.total?"text-emerald-600 font-semibold":"text-amber-600 font-semibold"}>{fmt(v)}</span>:"—" },
            { key:"fecha_ingreso", label:"Ingreso",   render:v=>fmtDate(v) },
          ]}
          data={filtered}
        />
      </Card>

      {/* ─── DETALLE ORDEN ─────────────────────────────────────────────────── */}
      {detalle && (
        <Modal title={`Orden ${detalle.numero_orden}`} onClose={() => setDetalle(null)} size="xl">
          <div className="space-y-5">
            {/* Acciones */}
            <div className="flex flex-wrap gap-2 items-center pb-4 border-b border-slate-100">
              <Badge className={`${ESTADO_COLOR[detalle.estado]} text-sm px-3 py-1`}>{ESTADO_LABEL[detalle.estado]}</Badge>
              {TRANSICIONES[detalle.estado]?.filter(s=>s!=="anulado").map(sig => (
                <Button key={sig} size="sm" variant="success" onClick={() => handleAvanzar(detalle, sig)} icon={<ChevronRight size={13}/>}>
                  → {ESTADO_LABEL[sig]}
                </Button>
              ))}
              {perms.repuestos_asignar && !["entregado","anulado"].includes(detalle.estado) && (
                <Button size="sm" variant="secondary" onClick={() => setRepModal(true)} icon={<Package size={13}/>}>Agregar repuesto</Button>
              )}
              {perms.pagos_registrar && detalle.total > detalle.pagado && !["anulado"].includes(detalle.estado) && (
                <Button size="sm" variant="warning" onClick={() => { setPagoModal(true); setPF({monto: Math.max(0, detalle.total - detalle.pagado), metodo:"efectivo", notas:""}); }} icon={<CreditCard size={13}/>}>Registrar pago</Button>
              )}
              {perms.ordenes_anular && !["entregado","anulado"].includes(detalle.estado) && (
                <Button size="sm" variant="danger" onClick={() => handleAnular(detalle)} icon={<XCircle size={13}/>}>Anular</Button>
              )}
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {[["Cliente",detalle.cliente_nombre],["Equipo",`${detalle.equipo_marca} ${detalle.equipo_modelo}`],["IMEI",detalle.imei||"No registrado"],["Ingreso",fmtDate(detalle.fecha_ingreso)],["Falla",detalle.falla_reportada||"—"],["Diagnóstico",detalle.diagnostico||"—"],["Mano de obra",fmt(detalle.valor_mano_obra)],["Descuento",`${detalle.descuento}%`]].map(([k,v])=>(
                <div key={k}><p className="text-xs text-slate-400 font-semibold uppercase mb-0.5">{k}</p><p className="font-semibold text-slate-800 text-sm">{v}</p></div>
              ))}
            </div>

            {/* Resumen financiero */}
            <div className="flex gap-8 p-4 bg-slate-50 rounded-xl">
              {[["Total",fmt(detalle.total),"text-indigo-700"],["Pagado",fmt(detalle.pagado),detalle.pagado>=detalle.total&&detalle.total>0?"text-emerald-600":"text-amber-600"],["Pendiente",fmt(Math.max(0,detalle.total-detalle.pagado)),"text-red-500"]].map(([k,v,c])=>(
                <div key={k}><p className="text-xs text-slate-500 uppercase font-semibold">{k}</p><p className={`text-2xl font-black mt-0.5 ${c}`}>{v}</p></div>
              ))}
            </div>

            {/* Repuestos */}
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">Repuestos asignados</p>
              {!detalle.oreps.length
                ? <p className="text-sm text-slate-400">Sin repuestos asignados.</p>
                : <DataTable columns={[
                    { key:"codigo",    label:"Código",   render:v=><span className="font-mono text-xs text-indigo-700">{v}</span> },
                    { key:"desc",      label:"Descripción" },
                    { key:"cantidad",  label:"Cant." },
                    { key:"valor_unitario", label:"Valor", render:v=>fmt(v) },
                    { key:"instalado", label:"Estado", render:v=><Badge className={v?"bg-green-100 text-green-700":"bg-amber-100 text-amber-700"}>{v?"Instalado":"Reservado"}</Badge> },
                    { key:"_acc", label:"", render:(_,r)=>(
                      <div className="flex gap-1">
                        {!r.instalado && perms.repuestos_instalar && <Button size="sm" onClick={()=>handleInstalar(r)} icon={<Check size={12}/>}>Instalar</Button>}
                        {!r.instalado && perms.repuestos_asignar  && <Button size="sm" variant="danger" onClick={()=>handleQuitarRep(r)}>Quitar</Button>}
                      </div>
                    )},
                  ]} data={detalle.oreps} />
              }
            </div>

            {/* Pagos */}
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">Historial de pagos</p>
              {!detalle.pagos.length
                ? <p className="text-sm text-slate-400">Sin pagos registrados.</p>
                : <DataTable columns={[
                    { key:"monto",  label:"Monto",  render:v=><span className="font-bold text-emerald-700">{fmt(v)}</span> },
                    { key:"metodo", label:"Método", render:v=><Badge className="bg-slate-100 text-slate-600 capitalize">{v}</Badge> },
                    { key:"notas",  label:"Notas" },
                    { key:"fecha",  label:"Fecha",  render:v=>fmtDate(v) },
                  ]} data={detalle.pagos} />
              }
            </div>

            {/* Flujo visual */}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-3">Flujo de la orden</p>
              <div className="flex items-center gap-1 flex-wrap">
                {ESTADOS.slice(0,-1).map((e,i) => {
                  const idx  = ESTADOS.indexOf(detalle.estado);
                  const done = i < idx; const active = i === idx;
                  return (
                    <div key={e} className="flex items-center gap-1">
                      <div className={`px-2.5 py-1 rounded text-xs font-semibold ${active?"bg-indigo-600 text-white":done?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-400"}`}>
                        {done && <Check size={10} className="inline mr-1" />}{ESTADO_LABEL[e]}
                      </div>
                      {i < ESTADOS.length-2 && <ChevronRight size={12} className="text-slate-300" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── NUEVA ORDEN ───────────────────────────────────────────────────── */}
      {newModal && (
        <Modal title="Nueva orden de reparación" onClose={()=>setNewModal(false)} size="lg"
          footer={<><Button variant="secondary" onClick={()=>setNewModal(false)}>Cancelar</Button><Button onClick={handleCrear} icon={<Plus size={14}/>}>Crear orden</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Cliente *" value={form.cliente_id} onChange={v=>setF({cliente_id:v})} className="col-span-2" required
              options={[{value:"",label:"— Seleccionar cliente —"},...clientes.map(c=>({value:String(c.id),label:`${c.nombre} · ${c.telefono}`}))]} />
            <Input label="Marca del equipo *" value={form.equipo_marca} onChange={v=>setF({equipo_marca:v})} required />
            <Input label="Modelo *" value={form.equipo_modelo} onChange={v=>setF({equipo_modelo:v})} required />
            <Input label="IMEI (opcional)" value={form.imei} onChange={v=>setF({imei:v})} hint="14–16 dígitos" className="col-span-2" />
            <Textarea label="Falla reportada" value={form.falla_reportada} onChange={v=>setF({falla_reportada:v})} className="col-span-2" />
            <Select label="Técnico asignado" value={form.tecnico_id} onChange={v=>setF({tecnico_id:v})}
              options={[{value:"",label:"— Sin asignar —"},...tecnicos.map(t=>({value:String(t.id),label:t.nombre}))]} />
            <Select label="Prioridad" value={form.prioridad} onChange={v=>setF({prioridad:v})}
              options={[{value:"normal",label:"Normal"},{value:"urgente",label:"Urgente"},{value:"vip",label:"VIP"}]} />
            <Input label="Mano de obra ($)" value={form.valor_mano_obra} onChange={v=>setF({valor_mano_obra:v})} type="number" />
            <Input label="Descuento (%)" value={form.descuento} onChange={v=>setF({descuento:v})} type="number" hint="0–100" />
          </div>
          {error && <Alert type="danger" className="mt-4">{error}</Alert>}
        </Modal>
      )}

      {/* ─── MODAL FIFO ────────────────────────────────────────────────────── */}
      {repModal && (
        <Modal title="Asignar repuesto — Selección FIFO" onClose={()=>{setRepModal(false);setRepResult(null);setRepError("");}} size="lg">
          <Alert type="info" className="mb-4">El sistema selecciona el repuesto del <strong>lote más antiguo</strong> con stock disponible (FIFO — sección 6.1).</Alert>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Input label="Tipo" value={busRep.tipo}   onChange={v=>setBR({tipo:v})}   placeholder="Pantalla, Batería…" />
            <Input label="Marca" value={busRep.marca}  onChange={v=>setBR({marca:v})}  placeholder="Samsung…" />
            <Input label="Modelo" value={busRep.modelo} onChange={v=>setBR({modelo:v})} placeholder="Galaxy S23…" />
          </div>
          <Button onClick={handleBuscarRep} icon={<SearchIcon size={14}/>}>Buscar disponibilidad</Button>
          {repError && <Alert type="danger" className="mt-3">{repError}</Alert>}
          {repResult && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="font-bold text-emerald-800 mb-3 text-sm">✓ Repuesto disponible (FIFO)</p>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                {[["Código",repResult.codigo_interno],["Descripción",`${repResult.tipo} ${repResult.marca} ${repResult.modelo}`],["Disponible",`${repResult.stock - repResult.stock_reservado} unidad(es)`],["Precio venta",fmt(repResult.costo_unitario * getCfg("factor_instalacion",1.5))],["Calidad",repResult.calidad],["Lote",`lote_id: ${repResult.lote_id}`]].map(([k,v])=>(
                  <div key={k}><span className="text-slate-500">{k}: </span><span className="font-semibold">{v}</span></div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAsignarRep} icon={<Check size={14}/>}>Confirmar reserva</Button>
                <Button variant="secondary" onClick={()=>setRepResult(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ─── MODAL PAGO ────────────────────────────────────────────────────── */}
      {pagoModal && (
        <Modal title={`Registrar pago · ${detalle?.numero_orden}`} onClose={()=>setPagoModal(false)} size="sm"
          footer={<><Button variant="secondary" onClick={()=>setPagoModal(false)}>Cancelar</Button><Button onClick={handlePago} icon={<Check size={14}/>}>Registrar</Button></>}>
          <div className="flex gap-6 mb-5 p-3 bg-slate-50 rounded-xl text-sm">
            <div><p className="text-slate-500 text-xs">Total</p><p className="font-black text-lg text-slate-800">{fmt(detalle?.total)}</p></div>
            <div><p className="text-slate-500 text-xs">Pendiente</p><p className="font-black text-lg text-amber-600">{fmt(Math.max(0,(detalle?.total??0)-(detalle?.pagado??0)))}</p></div>
          </div>
          <div className="space-y-3">
            <Input label="Monto ($) *" value={pagoForm.monto} onChange={v=>setPF({monto:v})} type="number" required />
            <Select label="Método de pago" value={pagoForm.metodo} onChange={v=>setPF({metodo:v})}
              options={[{value:"efectivo",label:"Efectivo"},{value:"tarjeta",label:"Tarjeta"},{value:"transferencia",label:"Transferencia"},{value:"otros",label:"Otros"}]} />
            <Input label="Notas" value={pagoForm.notas} onChange={v=>setPF({notas:v})} placeholder="Referencia, observación…" />
          </div>
        </Modal>
      )}
    </div>
  );
}
