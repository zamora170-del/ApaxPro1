// ─── COMPONENTES DE UI REUTILIZABLES ─────────────────────────────────────────
import { useState, useEffect } from "react";
import { X, Search, ChevronRight, ChevronLeft, AlertTriangle, AlertCircle, CheckCircle, Info } from "lucide-react";

// ─── BADGE ────────────────────────────────────────────────────────────────────
export function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold leading-tight ${className}`}>
      {children}
    </span>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = "", onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${className}`}>
      {children}
    </div>
  );
}

// ─── BUTTON ───────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary:   "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm focus:ring-indigo-500",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400",
  danger:    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  success:   "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
  warning:   "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400",
  ghost:     "text-slate-600 hover:bg-slate-100 focus:ring-slate-400",
};
const BTN_SIZES = { sm:"px-3 py-1.5 text-xs gap-1.5", md:"px-4 py-2 text-sm gap-2", lg:"px-5 py-2.5 text-base gap-2" };

export function Button({ children, onClick, variant = "primary", size = "md", className = "", disabled = false, icon, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center font-semibold rounded-lg transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, type = "text", placeholder, required, disabled, readOnly,
  className = "", hint, onKeyDown, autoFocus }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type} value={value ?? ""} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} disabled={disabled} required={required}
        readOnly={readOnly} onKeyDown={onKeyDown} autoFocus={autoFocus}
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:bg-slate-50 disabled:text-slate-400 transition"
      />
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── TEXTAREA ─────────────────────────────────────────────────────────────────
export function Textarea({ label, value, onChange, rows = 3, placeholder, className = "", hint }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>}
      <textarea rows={rows} value={value ?? ""} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none
          focus:ring-2 focus:ring-indigo-500 resize-none transition" />
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── SELECT ───────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, className = "", required }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select value={value ?? ""} onChange={e => onChange?.(e.target.value)}
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white
          focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── TOGGLE ───────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-slate-200"}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </label>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
const MODAL_SIZES = { sm:"max-w-md", md:"max-w-xl", lg:"max-w-2xl", xl:"max-w-4xl", full:"max-w-6xl" };

export function Modal({ title, children, onClose, size = "md", footer }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${MODAL_SIZES[size]} max-h-[92vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
        {/* Footer */}
        {footer && <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

// ─── PAGE HEADER ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
const KPI_COLORS = {
  indigo: "bg-indigo-50 text-indigo-600",
  green:  "bg-emerald-50 text-emerald-600",
  amber:  "bg-amber-50 text-amber-600",
  red:    "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
  teal:   "bg-teal-50 text-teal-600",
};

export function KpiCard({ title, value, sub, icon: Icon, color = "indigo", trend }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">{title}</p>
          <p className="text-2xl font-black text-slate-900 mt-1 leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ml-3 ${KPI_COLORS[color]}`}>
          <Icon size={22} />
        </div>
      </div>
      {trend !== undefined && (
        <p className={`text-xs font-semibold mt-3 flex items-center gap-1 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs. período anterior
        </p>
      )}
    </Card>
  );
}

// ─── DATA TABLE ───────────────────────────────────────────────────────────────
export function DataTable({ columns, data, onRowClick, emptyText = "Sin registros", loading }) {
  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full spin mx-auto" />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c, i) => (
              <th key={c.key ?? i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!data.length && (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">{emptyText}</td></tr>
          )}
          {data.map((row, i) => (
            <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
              className={`border-b border-slate-100 transition-colors ${onRowClick ? "cursor-pointer hover:bg-indigo-50/50" : ""}`}>
              {columns.map((c, j) => (
                <td key={c.key ?? j} className="px-4 py-3 text-slate-700">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SEARCH INPUT ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = "Buscar...", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition" />
    </div>
  );
}

// ─── ALERT BANNER ─────────────────────────────────────────────────────────────
const ALERT_STYLES = {
  warning: { wrap: "bg-amber-50 border border-amber-200 text-amber-800", icon: AlertTriangle },
  danger:  { wrap: "bg-red-50 border border-red-200 text-red-800",       icon: AlertCircle },
  success: { wrap: "bg-emerald-50 border border-emerald-200 text-emerald-800", icon: CheckCircle },
  info:    { wrap: "bg-blue-50 border border-blue-200 text-blue-800",    icon: Info },
};

export function Alert({ type = "info", children, className = "" }) {
  const { wrap, icon: Icon } = ALERT_STYLES[type] ?? ALERT_STYLES.info;
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg text-sm font-medium ${wrap} ${className}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
export function Pagination({ page, total, perPage = 20, onChange }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <p className="text-xs text-slate-500">
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 transition">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          const p = pages <= 7 ? i + 1 : i === 0 ? 1 : i === 6 ? pages : page - 3 + i;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`w-7 h-7 rounded text-xs font-semibold transition
                ${p === page ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-600"}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onChange(page + 1)} disabled={page >= pages}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 transition">
          <ChevronRight size={16} className="text-slate-600" />
        </button>
      </div>
    </div>
  );
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
export function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = "Confirmar", variant = "danger" }) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
      <div className="flex gap-2 mt-6 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition
            ${active === t.id ? "bg-white shadow-sm text-indigo-700" : "text-slate-600 hover:text-slate-900"}`}>
          {t.icon && <t.icon size={15} />}{t.label}
        </button>
      ))}
    </div>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon size={28} className="text-slate-400" />
      </div>
      <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
export const fmt = n => new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", minimumFractionDigits:0 }).format(n ?? 0);
export const fmtDate = d => d ? new Date(d).toLocaleDateString("es-CO", { day:"2-digit", month:"2-digit", year:"numeric" }) : "—";
export const fmtDateTime = d => d ? new Date(d).toLocaleString("es-CO", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
