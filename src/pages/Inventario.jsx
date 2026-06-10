import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, RefreshCw, BookOpen, Download } from "lucide-react";
import { db, T, getCfg } from "../db/index.js";
import { crearRepuesto, editarRepuesto, eliminarRepuesto, ajustarStock, crearLote, crearProveedor, editarProveedor } from "../services/repuestos.js";
import { exportarCSV } from "../services/config.js";
import { PERMISOS, CALIDAD_COLOR, KARDEX_LABEL, KARDEX_COLOR, KARDEX_SIGNO } from "../constants.js";
import { PageHeader, Card, Button, Input, Select, Modal, DataTable, SearchInput, KpiCard, Badge, Alert, Tabs, fmt, fmtDate } from "../components/ui/index.jsx";
import { Package, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const TABS_INV = [
  { id:"repuestos",   label:"Repuestos",   icon: Package },
  { id:"lotes",       label:"Lotes",       icon: RefreshCw },
  { id:"proveedores", label:"Proveedores", icon: CheckCircle },
];

export default function Inventario({ user }) {
  const perms    = PERMISOS[user.rol] || {};
  const [tab,    setTab]    = useState("repuestos");
  const [search, setSearch] = useState("");

  // Repuestos
  const [repuestos, setRepuestos] = useState([]);
  const [lotes,     setLotes]     = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [kardexModal, setKardexModal] = useState(null);
  const [ajusteModal, setAjusteModal] = useState(null);
  const [ajusteForm,  setAjusteForm]  = useState({ tipo:"ajuste_entrada", cantidad:1, motivo:"" });
  const [newRepModal, setNewRepModal] = useState(false);
  const [repForm, setRepForm] = useState({ tipo:"", marca:"", modelo:"", calidad:"compatible", ubicacion:"", lote_id:"1", stock_inicial:1 });
  const [editRepModal, setEditRepModal] = useState(null);

  // Lotes
  const [newLoteModal, setNewLoteModal] = useState(false);
  const [loteForm, setLoteForm] = useState({ referencia:"", proveedor_id:"1", fecha_compra: db.today(), factura:"", cantidad:1, costo_unitario:0 });

  // Proveedores
  const [newProvModal, setNewProvModal] = useState(false);
  const [provForm, setProvForm] = useState({ nombre:"", telefono:"", email:"", confiabilidad:5 });
  const [editProvModal, setEditProvModal] = useState(null);

  const [error, setError] = useState("");

  const cargar = () => {
    const reps  = db.getArr(T.REPUESTOS).filter(r => !r.deleted_at);
    const lots  = db.getArr(T.LOTES);
    const provs = db.getArr(T.PROVEEDORES);
    const cfg   = db.get(T.CONFIG) || {};
    const factor = parseFloat(cfg.factor_instalacion?.valor ?? "1.5");
    setRepuestos(reps.map(r => {
      const lote = lots.find(l => l.id === r.lote_id) || {};
      return { ...r, costo_unitario: lote.costo_unitario ?? 0, lote_ref: lote.referencia ?? "—", precio_venta: (lote.costo_unitario ?? 0) * factor };
    }));
    setLotes(lots.map(l => { const p = provs.find(x => x.id === l.proveedor_id); return { ...l, proveedor_nombre: p?.nombre ?? "—" }; }));
    setProveedores(provs);
  };
  useEffect(cargar, []);

  const stockMin = getCfg("stock_minimo_global", 2);

  const filteredReps = repuestos.filter(r =>
    r.codigo_interno.toLowerCase().includes(search.toLowerCase()) ||
    r.tipo.toLowerCase().includes(search.toLowerCase()) ||
    r.marca.toLowerCase().includes(search.toLowerCase()) ||
    r.modelo.toLowerCase().includes(search.toLowerCase())
  );

  const CALIDAD_OPT = [{ value:"original",label:"Original" },{ value:"compatible",label:"Compatible" },{ value:"remanufacturado",label:"Remanufacturado" }];
  const AJUSTE_OPT  = [{ value:"ajuste_entrada",label:"Ajuste entrada (+)" },{ value:"ajuste_salida",label:"Ajuste salida (−)" },{ value:"perdida",label:"Pérdida / Extravío" }];

  const handleCrearRep = () => {
    setError("");
    if (!repForm.tipo.trim() || !repForm.marca.trim() || !repForm.modelo.trim()) { setError("Tipo, marca y modelo son requeridos."); return; }
    try {
      crearRepuesto({ tipo: repForm.tipo, marca: repForm.marca, modelo: repForm.modelo, calidad: repForm.calidad, ubicacion: repForm.ubicacion, loteId: parseInt(repForm.lote_id) || 1, costoUnitario: 0, stockInicial: parseInt(repForm.stock_inicial) || 0 }, user.id);
      cargar(); setNewRepModal(false); setRepForm({ tipo:"", marca:"", modelo:"", calidad:"compatible", ubicacion:"", lote_id:"1", stock_inicial:1 });
    } catch (e) { setError(e.message); }
  };

  const handleEditarRep = () => {
    setError("");
    if (!editRepModal) return;
    try {
      editarRepuesto(editRepModal.id, { tipo: editRepModal.tipo, marca: editRepModal.marca, modelo: editRepModal.modelo, calidad: editRepModal.calidad, ubicacion: editRepModal.ubicacion }, user.id);
      cargar(); setEditRepModal(null);
    } catch (e) { setError(e.message); }
  };

  const handleEliminarRep = (rep) => {
    if (!confirm(`¿Eliminar ${rep.codigo_interno}?`)) return;
    try { eliminarRepuesto(rep.id, user.id); cargar(); } catch (e) { alert(e.message); }
  };

  const handleAjuste = () => {
    setError("");
    if (!ajusteForm.motivo.trim()) { setError("El motivo es obligatorio."); return; }
    try {
      ajustarStock({ repuestoId: ajusteModal.id, tipo: ajusteForm.tipo, cantidad: parseInt(ajusteForm.cantidad), motivo: ajusteForm.motivo, userId: user.id });
      cargar(); setAjusteModal(null); setAjusteForm({ tipo:"ajuste_entrada", cantidad:1, motivo:"" });
    } catch (e) { setError(e.message === "STOCK_INSUFICIENTE" ? "Stock insuficiente para ese ajuste." : e.message); }
  };

  const handleCrearLote = () => {
    setError("");
    if (!loteForm.referencia.trim()) { setError("La referencia es requerida."); return; }
    try {
      crearLote({ referencia: loteForm.referencia, proveedorId: parseInt(loteForm.proveedor_id), fechaCompra: loteForm.fecha_compra, factura: loteForm.factura, cantidad: parseInt(loteForm.cantidad), costoUnitario: parseFloat(loteForm.costo_unitario) }, user.id);
      cargar(); setNewLoteModal(false); setLoteForm({ referencia:"", proveedor_id:"1", fecha_compra: db.today(), factura:"", cantidad:1, costo_unitario:0 });
    } catch (e) { setError(e.message); }
  };

  const handleCrearProv = () => {
    setError("");
    if (!provForm.nombre.trim()) { setError("El nombre es requerido."); return; }
    try {
      crearProveedor(provForm, user.id);
      cargar(); setNewProvModal(false); setProvForm({ nombre:"", telefono:"", email:"", confiabilidad:5 });
    } catch (e) { setError(e.message); }
  };

  const handleEditarProv = () => {
    setError("");
    if (!editProvModal) return;
    try {
      editarProveedor(editProvModal.id, { nombre: editProvModal.nombre, telefono: editProvModal.telefono, email: editProvModal.email, confiabilidad: editProvModal.confiabilidad }, user.id);
      cargar(); setEditProvModal(null);
    } catch (e) { setError(e.message); }
  };

  const kardexDeRep = kardexModal ? db.getArr(T.KARDEX).filter(k => k.repuesto_id === kardexModal.id).sort((a,b)=>b.id-a.id) : [];

  return (
    <div className="page-in">
      <PageHeader title="Inventario" subtitle={`${repuestos.length} repuestos · Factor ×${getCfg("factor_instalacion",1.5)}`}
        actions={<>
          <Button variant="secondary" size="sm" onClick={()=>exportarCSV(T.REPUESTOS)} icon={<Download size={14}/>}>CSV</Button>
          {perms.inventario_lote    && <Button variant="secondary" size="sm" onClick={()=>{setNewLoteModal(true);setError("");}}>+ Lote</Button>}
          {perms.inventario_ingresar && <Button onClick={()=>{setNewRepModal(true);setError("");}} icon={<Plus size={16}/>}>Nuevo repuesto</Button>}
        </>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total repuestos"   value={repuestos.length}                                                       icon={Package}       color="indigo" />
        <KpiCard title="Stock disponible"  value={repuestos.reduce((s,r)=>s+(r.stock-r.stock_reservado),0)}               icon={CheckCircle}   color="green" />
        <KpiCard title="Reservados"        value={repuestos.reduce((s,r)=>s+r.stock_reservado,0)}                          icon={Clock}         color="amber" />
        <KpiCard title="Bajo mínimo"       value={repuestos.filter(r=>(r.stock-r.stock_reservado)<=stockMin).length}      icon={AlertTriangle} color="red" />
      </div>

      <Tabs tabs={TABS_INV} active={tab} onChange={setTab} />

      {/* ─── REPUESTOS ─────────────────────────────────────────────────────── */}
      {tab === "repuestos" && (
        <Card>
          <div className="p-4 border-b border-slate-200">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar código, tipo, marca, modelo…" className="max-w-sm" />
          </div>
          <DataTable
            columns={[
              { key:"codigo_interno", label:"Código",    render:v=><span className="font-mono text-xs font-bold text-indigo-700">{v}</span> },
              { key:"tipo",    label:"Tipo" },
              { key:"marca",   label:"Marca" },
              { key:"modelo",  label:"Modelo" },
              { key:"calidad", label:"Calidad",  render:v=><Badge className={CALIDAD_COLOR[v]||"bg-slate-100 text-slate-600"}>{v}</Badge> },
              { key:"stock",   label:"Stock",    render:v=><span className="font-bold">{v}</span> },
              { key:"stock_reservado", label:"Reservado", render:v=><span className="text-amber-600 font-semibold">{v}</span> },
              { key:"disp",    label:"Disponible", render:(_,r)=>{ const d=r.stock-r.stock_reservado; return <span className={`font-bold ${d<=0?"text-red-600":d<=stockMin?"text-amber-600":"text-emerald-600"}`}>{d}</span>; } },
              { key:"precio_venta", label:"Precio venta", render:v=><span className="font-semibold text-indigo-700">{fmt(v)}</span> },
              { key:"ubicacion", label:"Ubic.", render:v=>v?<Badge className="bg-slate-100 text-slate-600">{v}</Badge>:"—" },
              { key:"_acc", label:"", render:(_,row)=>(
                <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setKardexModal(row)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition" title="Kardex"><BookOpen size={14}/></button>
                  {perms.inventario_ajuste && <button onClick={()=>{setAjusteModal(row);setAjusteForm({tipo:"ajuste_entrada",cantidad:1,motivo:""});setError("");}} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition" title="Ajuste"><RefreshCw size={14}/></button>}
                  {perms.inventario_ingresar && <button onClick={()=>setEditRepModal({...row})} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"><Edit2 size={14}/></button>}
                  {perms.inventario_ingresar && <button onClick={()=>handleEliminarRep(row)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"><Trash2 size={14}/></button>}
                </div>
              )},
            ]}
            data={filteredReps}
          />
        </Card>
      )}

      {/* ─── LOTES ─────────────────────────────────────────────────────────── */}
      {tab === "lotes" && (
        <Card>
          <DataTable columns={[
            { key:"id",         label:"ID" },
            { key:"referencia", label:"Referencia", render:v=><span className="font-semibold">{v}</span> },
            { key:"proveedor_nombre", label:"Proveedor" },
            { key:"fecha_compra",     label:"Fecha compra", render:v=>fmtDate(v) },
            { key:"cantidad",         label:"Cantidad" },
            { key:"costo_unitario",   label:"Costo unitario", render:v=>fmt(v) },
            { key:"factura",          label:"Factura" },
          ]} data={lotes} />
        </Card>
      )}

      {/* ─── PROVEEDORES ───────────────────────────────────────────────────── */}
      {tab === "proveedores" && (
        <Card>
          <div className="p-4 border-b flex justify-end">
            {perms.inventario_lote && <Button size="sm" onClick={()=>{setNewProvModal(true);setError("");}} icon={<Plus size={14}/>}>Nuevo proveedor</Button>}
          </div>
          <DataTable columns={[
            { key:"nombre",        label:"Nombre",       render:v=><span className="font-semibold">{v}</span> },
            { key:"telefono",      label:"Teléfono" },
            { key:"email",         label:"Email" },
            { key:"confiabilidad", label:"Confiabilidad",render:v=><span className="font-bold text-indigo-700">{v}/5</span> },
            { key:"_acc", label:"", render:(_,row)=>(
              <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                {perms.inventario_lote && <button onClick={()=>setEditProvModal({...row})} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"><Edit2 size={14}/></button>}
              </div>
            )},
          ]} data={proveedores} />
        </Card>
      )}

      {/* ─── MODAL KARDEX (inmutable) ──────────────────────────────────────── */}
      {kardexModal && (
        <Modal title={`Kardex · ${kardexModal.codigo_interno} — ${kardexModal.tipo} ${kardexModal.marca} ${kardexModal.modelo}`} onClose={()=>setKardexModal(null)} size="lg">
          <Alert type="info" className="mb-4">Los movimientos de kardex son <strong>inmutables</strong>. Para corregir errores use ajuste_entrada o ajuste_salida.</Alert>
          <DataTable columns={[
            { key:"tipo",      label:"Tipo",     render:v=><Badge className={KARDEX_COLOR[v]}>{KARDEX_LABEL[v]}</Badge> },
            { key:"cantidad",  label:"Cantidad", render:(v,r)=><span className={`font-bold font-mono ${["entrada","ajuste_entrada"].includes(r.tipo)?"text-emerald-600":"text-red-600"}`}>{KARDEX_SIGNO[r.tipo]}{v}</span> },
            { key:"motivo",    label:"Motivo" },
            { key:"created_at",label:"Fecha",    render:v=>fmtDate(v) },
          ]} data={kardexDeRep} emptyText="Sin movimientos registrados." />
        </Modal>
      )}

      {/* ─── MODAL AJUSTE STOCK ───────────────────────────────────────────── */}
      {ajusteModal && (
        <Modal title={`Ajuste · ${ajusteModal.codigo_interno}`} onClose={()=>setAjusteModal(null)} size="sm"
          footer={<><Button variant="secondary" onClick={()=>setAjusteModal(null)}>Cancelar</Button><Button onClick={handleAjuste}>Registrar</Button></>}>
          <p className="text-sm text-slate-500 mb-4">Stock actual: <strong>{ajusteModal.stock}</strong> · Disponible: <strong>{ajusteModal.stock - ajusteModal.stock_reservado}</strong></p>
          <div className="space-y-3">
            <Select label="Tipo de ajuste" value={ajusteForm.tipo} onChange={v=>setAjusteForm(p=>({...p,tipo:v}))} options={AJUSTE_OPT} />
            <Input label="Cantidad *" value={ajusteForm.cantidad} onChange={v=>setAjusteForm(p=>({...p,cantidad:v}))} type="number" hint="Siempre positiva" />
            <Input label="Motivo *" value={ajusteForm.motivo} onChange={v=>setAjusteForm(p=>({...p,motivo:v}))} placeholder="Ej: conteo físico, rotura…" required />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {/* ─── MODAL NUEVO REPUESTO ─────────────────────────────────────────── */}
      {newRepModal && (
        <Modal title="Nuevo repuesto" onClose={()=>setNewRepModal(false)}
          footer={<><Button variant="secondary" onClick={()=>setNewRepModal(false)}>Cancelar</Button><Button onClick={handleCrearRep} icon={<Plus size={14}/>}>Registrar</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tipo *" value={repForm.tipo} onChange={v=>setRepForm(p=>({...p,tipo:v}))} placeholder="Pantalla, Batería…" required className="col-span-2" />
            <Input label="Marca *" value={repForm.marca} onChange={v=>setRepForm(p=>({...p,marca:v}))} required />
            <Input label="Modelo *" value={repForm.modelo} onChange={v=>setRepForm(p=>({...p,modelo:v}))} required />
            <Select label="Calidad" value={repForm.calidad} onChange={v=>setRepForm(p=>({...p,calidad:v}))} options={CALIDAD_OPT} />
            <Input label="Ubicación" value={repForm.ubicacion} onChange={v=>setRepForm(p=>({...p,ubicacion:v}))} placeholder="A-01" />
            <Select label="Lote" value={repForm.lote_id} onChange={v=>setRepForm(p=>({...p,lote_id:v}))}
              options={lotes.map(l=>({value:String(l.id),label:`${l.referencia} (${fmtDate(l.fecha_compra)})`}))} />
            <Input label="Stock inicial" value={repForm.stock_inicial} onChange={v=>setRepForm(p=>({...p,stock_inicial:v}))} type="number" />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {/* ─── MODAL EDITAR REPUESTO ────────────────────────────────────────── */}
      {editRepModal && (
        <Modal title={`Editar · ${editRepModal.codigo_interno}`} onClose={()=>setEditRepModal(null)}
          footer={<><Button variant="secondary" onClick={()=>setEditRepModal(null)}>Cancelar</Button><Button onClick={handleEditarRep}>Guardar</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tipo *" value={editRepModal.tipo} onChange={v=>setEditRepModal(p=>({...p,tipo:v}))} className="col-span-2" required />
            <Input label="Marca *" value={editRepModal.marca} onChange={v=>setEditRepModal(p=>({...p,marca:v}))} required />
            <Input label="Modelo *" value={editRepModal.modelo} onChange={v=>setEditRepModal(p=>({...p,modelo:v}))} required />
            <Select label="Calidad" value={editRepModal.calidad} onChange={v=>setEditRepModal(p=>({...p,calidad:v}))} options={CALIDAD_OPT} />
            <Input label="Ubicación" value={editRepModal.ubicacion??""} onChange={v=>setEditRepModal(p=>({...p,ubicacion:v}))} />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {/* ─── MODAL NUEVO LOTE ─────────────────────────────────────────────── */}
      {newLoteModal && (
        <Modal title="Nuevo lote de compra" onClose={()=>setNewLoteModal(false)}
          footer={<><Button variant="secondary" onClick={()=>setNewLoteModal(false)}>Cancelar</Button><Button onClick={handleCrearLote} icon={<Plus size={14}/>}>Registrar lote</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Referencia *" value={loteForm.referencia} onChange={v=>setLoteForm(p=>({...p,referencia:v}))} required className="col-span-2" />
            <Select label="Proveedor" value={loteForm.proveedor_id} onChange={v=>setLoteForm(p=>({...p,proveedor_id:v}))}
              options={proveedores.map(p=>({value:String(p.id),label:p.nombre}))} />
            <Input label="Fecha de compra" value={loteForm.fecha_compra} onChange={v=>setLoteForm(p=>({...p,fecha_compra:v}))} type="date" />
            <Input label="Factura" value={loteForm.factura} onChange={v=>setLoteForm(p=>({...p,factura:v}))} />
            <Input label="Cantidad" value={loteForm.cantidad} onChange={v=>setLoteForm(p=>({...p,cantidad:v}))} type="number" />
            <Input label="Costo unitario ($)" value={loteForm.costo_unitario} onChange={v=>setLoteForm(p=>({...p,costo_unitario:v}))} type="number" className="col-span-2" />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {/* ─── MODALES PROVEEDORES ──────────────────────────────────────────── */}
      {newProvModal && (
        <Modal title="Nuevo proveedor" onClose={()=>setNewProvModal(false)} size="sm"
          footer={<><Button variant="secondary" onClick={()=>setNewProvModal(false)}>Cancelar</Button><Button onClick={handleCrearProv} icon={<Plus size={14}/>}>Crear</Button></>}>
          <div className="space-y-3">
            <Input label="Nombre *" value={provForm.nombre} onChange={v=>setProvForm(p=>({...p,nombre:v}))} required />
            <Input label="Teléfono" value={provForm.telefono} onChange={v=>setProvForm(p=>({...p,telefono:v}))} />
            <Input label="Email" value={provForm.email} onChange={v=>setProvForm(p=>({...p,email:v}))} type="email" />
            <Input label="Confiabilidad (0-5)" value={provForm.confiabilidad} onChange={v=>setProvForm(p=>({...p,confiabilidad:v}))} type="number" hint="0 = nula · 5 = excelente" />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}

      {editProvModal && (
        <Modal title={`Editar proveedor · ${editProvModal.nombre}`} onClose={()=>setEditProvModal(null)} size="sm"
          footer={<><Button variant="secondary" onClick={()=>setEditProvModal(null)}>Cancelar</Button><Button onClick={handleEditarProv}>Guardar</Button></>}>
          <div className="space-y-3">
            <Input label="Nombre *" value={editProvModal.nombre} onChange={v=>setEditProvModal(p=>({...p,nombre:v}))} required />
            <Input label="Teléfono" value={editProvModal.telefono??""} onChange={v=>setEditProvModal(p=>({...p,telefono:v}))} />
            <Input label="Email" value={editProvModal.email??""} onChange={v=>setEditProvModal(p=>({...p,email:v}))} type="email" />
            <Input label="Confiabilidad (0-5)" value={editProvModal.confiabilidad} onChange={v=>setEditProvModal(p=>({...p,confiabilidad:parseFloat(v)}))} type="number" />
          </div>
          {error && <Alert type="danger" className="mt-3">{error}</Alert>}
        </Modal>
      )}
    </div>
  );
}
