import { useState, useEffect } from "react";
import { Plus, Download, Phone, Mail, MapPin, Edit2, Trash2, FileText } from "lucide-react";
import { db, T } from "../db/index.js";
import { crearCliente, editarCliente, eliminarCliente } from "../services/ordenes.js";
import { exportarCSV } from "../services/config.js";
import { PERMISOS, ESTADO_COLOR, ESTADO_LABEL } from "../constants.js";
import { PageHeader, Card, Button, Input, Modal, DataTable, SearchInput, Alert, ConfirmDialog, Badge, fmtDate, fmt } from "../components/ui/index.jsx";

export default function Clientes({ user }) {
  const perms = PERMISOS[user.rol] || {};
  const [clientes, setClientes] = useState([]);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState(null); // null | "nuevo" | cliente
  const [histModal,setHistModal]= useState(null);
  const [confirm,  setConfirm]  = useState(null);
  const [form,     setForm]     = useState({ nombre:"", telefono:"", email:"", direccion:"" });
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const cargar = () => setClientes(db.getArr(T.CLIENTES).filter(c => !c.deleted_at));
  useEffect(cargar, []);

  const setF = f => setForm(p => ({ ...p, ...f }));

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono.includes(search) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const abrirNuevo = () => { setForm({ nombre:"", telefono:"", email:"", direccion:"" }); setError(""); setModal("nuevo"); };
  const abrirEditar = c => { setForm({ nombre:c.nombre, telefono:c.telefono, email:c.email??"", direccion:c.direccion??"" }); setError(""); setModal(c); };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.telefono.trim()) { setError("Nombre y teléfono son requeridos."); return; }
    setLoading(true); setError("");
    try {
      if (modal === "nuevo") {
        crearCliente(form, user.id);
      } else {
        editarCliente(modal.id, form, user.id);
      }
      cargar(); setModal(null);
    } catch (e) {
      setError(e.message === "TELEFONO_DUPLICADO" ? "Ya existe un cliente con ese teléfono." : e.message);
    } finally { setLoading(false); }
  };

  const confirmarEliminar = c => setConfirm(c);
  const ejecutarEliminar = () => {
    try { eliminarCliente(confirm.id, user.id); cargar(); setConfirm(null); }
    catch (e) { alert(e.message === "CLIENTE_CON_ORDENES_ACTIVAS" ? "Este cliente tiene órdenes activas." : e.message); setConfirm(null); }
  };

  const verHistorial = c => {
    const ordenes = db.getArr(T.ORDENES).filter(o => o.cliente_id === c.id);
    setHistModal({ cliente: c, ordenes });
  };

  const columns = [
    { key:"nombre",   label:"Nombre",   render: v => <span className="font-semibold text-slate-800">{v}</span> },
    { key:"telefono", label:"Teléfono", render: v => <span className="flex items-center gap-1 text-slate-600"><Phone size={12} />{v}</span> },
    { key:"email",    label:"Email",    render: v => v ? <span className="flex items-center gap-1"><Mail size={12} />{v}</span> : <span className="text-slate-300">—</span> },
    { key:"direccion",label:"Dirección",render: v => v ? <span className="flex items-center gap-1"><MapPin size={12} />{v}</span> : <span className="text-slate-300">—</span> },
    { key:"created_at",label:"Registro",render: v => fmtDate(v) },
    { key:"_acc", label:"", render:(_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => verHistorial(row)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition" title="Historial"><FileText size={14} /></button>
        {perms.clientes_editar && <button onClick={() => abrirEditar(row)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"><Edit2 size={14} /></button>}
        {perms.clientes_eliminar && <button onClick={() => confirmarEliminar(row)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"><Trash2 size={14} /></button>}
      </div>
    )},
  ];

  return (
    <div className="page-in">
      <PageHeader title="Clientes" subtitle={`${filtered.length} registrados`}
        actions={<>
          <Button variant="secondary" size="sm" onClick={() => exportarCSV(T.CLIENTES)} icon={<Download size={14} />}>CSV</Button>
          {perms.clientes_editar && <Button onClick={abrirNuevo} icon={<Plus size={16} />}>Nuevo cliente</Button>}
        </>}
      />
      <Card>
        <div className="p-4 border-b border-slate-200">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, teléfono, email..." className="max-w-sm" />
        </div>
        <DataTable columns={columns} data={filtered} onRowClick={perms.clientes_editar ? abrirEditar : undefined} />
      </Card>

      {/* Modal crear/editar */}
      {modal && (
        <Modal title={modal === "nuevo" ? "Nuevo cliente" : `Editar · ${modal.nombre}`} onClose={() => setModal(null)}
          footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button><Button onClick={guardar} disabled={loading}>Guardar</Button></>}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre completo *" value={form.nombre} onChange={v => setF({nombre:v})} required className="col-span-2" />
            <Input label="Teléfono *" value={form.telefono} onChange={v => setF({telefono:v})} required hint="Único por cliente" />
            <Input label="Email" value={form.email} onChange={v => setF({email:v})} type="email" />
            <Input label="Dirección" value={form.direccion} onChange={v => setF({direccion:v})} className="col-span-2" />
          </div>
          {error && <Alert type="danger" className="mt-4">{error}</Alert>}
        </Modal>
      )}

      {/* Modal historial */}
      {histModal && (
        <Modal title={`Historial · ${histModal.cliente.nombre}`} onClose={() => setHistModal(null)} size="lg">
          {!histModal.ordenes.length
            ? <p className="text-slate-400 text-center py-8">Sin órdenes registradas.</p>
            : <DataTable
                columns={[
                  { key:"numero_orden", label:"Orden", render:v=><span className="font-mono text-xs font-bold text-indigo-700">{v}</span> },
                  { key:"equipo_marca", label:"Equipo", render:(v,r)=>`${v} ${r.equipo_modelo}` },
                  { key:"estado", label:"Estado", render:v=><Badge className={ESTADO_COLOR[v]}>{ESTADO_LABEL[v]}</Badge> },
                  { key:"fecha_ingreso", label:"Ingreso", render:v=>fmtDate(v) },
                ]}
                data={histModal.ordenes}
              />
          }
        </Modal>
      )}

      {/* Confirm eliminar */}
      {confirm && <ConfirmDialog title="Eliminar cliente" message={`¿Eliminar a ${confirm.nombre}? Esta acción no se puede deshacer.`} onConfirm={ejecutarEliminar} onCancel={() => setConfirm(null)} confirmLabel="Eliminar" />}
    </div>
  );
}
