import { useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ProductCard({ p, onUpdated }) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delta, setDelta] = useState(1);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    nombre: p.nombre ?? "",
    categoria: p.categoria ?? "General",
    presentacion: p.presentacion ?? "",
    costo: p.costo ?? 0,
    precio_venta: p.precio_venta ?? 0,
    stock_minimo: p.stock_minimo ?? 0,
    codigo: p.codigo ?? "",
  });

  // margen/ganancia por unidad (vista rápida)
  const margen = useMemo(() => Number(p.precio_venta) - Number(p.costo), [p]);

  const bajoStock = Number(p.stock) <= Number(p.stock_minimo);

  function setF(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function guardar() {
    setErr("");
    const payload = {
      nombre: form.nombre.trim(),
      categoria: (form.categoria || "General").trim(),
      presentacion: form.presentacion.trim() || null,
      codigo: form.codigo.trim() || null,
      costo: Number(form.costo),
      precio_venta: Number(form.precio_venta),
      stock_minimo: Number(form.stock_minimo || 0),
    };

    if (!payload.nombre) return setErr("Nombre requerido.");
    if (!Number.isFinite(payload.costo) || !Number.isFinite(payload.precio_venta)) {
      return setErr("Costo y precio deben ser números.");
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/productos/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "No se pudo guardar.");
        return;
      }
      setEdit(false);
      onUpdated?.(data);
    } catch {
      setErr("No se pudo conectar con el backend.");
    } finally {
      setSaving(false);
    }
  }

  async function ajustarStock(sign) {
    setErr("");
    const d = Number(delta);
    if (!Number.isFinite(d) || d <= 0) return setErr("Delta inválido.");

    const payload = { delta: sign * d };

    setSaving(true);
    try {
      const res = await fetch(`${API}/productos/${p.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || "No se pudo ajustar stock.");
        return;
      }
      onUpdated?.(data);
    } catch {
      setErr("No se pudo conectar con el backend.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, color: "#fff", fontSize: 16, lineHeight: 1.2 }}>
            {p.nombre} {p.presentacion ? `(${p.presentacion})` : ""}
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 4 }}>
            {p.categoria || "General"} {p.codigo ? `• Código: ${p.codigo}` : ""}
          </div>
        </div>

        <button
          className="btnAccent"
          onClick={() => {
            setErr("");
            setEdit((v) => !v);
          }}
          style={{ background: edit ? "#64748b" : "var(--brand)" }}
        >
          {edit ? "Cerrar" : "Editar"}
        </button>
      </div>

      {/* Stock badge */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: bajoStock ? "rgba(220,38,38,0.25)" : "rgba(34,197,94,0.18)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          Stock: {p.stock} (min {p.stock_minimo})
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          Precio: ${p.precio_venta} • Costo: ${p.costo} • Margen: ${margen}
        </div>
      </div>

      {/* Ajuste stock rápido */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <input
          className="input"
          style={{ width: 90 }}
          inputMode="numeric"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
        <button className="btnAccent" disabled={saving} onClick={() => ajustarStock(+1)}>
          + Stock
        </button>
        <button
          className="btnAccent"
          disabled={saving}
          onClick={() => ajustarStock(-1)}
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          - Stock
        </button>
      </div>

      {/* Modo edición */}
      {edit && (
        <div
          style={{
            marginTop: 12,
            background: "rgba(255,255,255,0.75)",
            borderRadius: 14,
            padding: 12,
            border: "1px solid rgba(31,47,85,0.18)",
          }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Nombre</div>
                <input className="input" value={form.nombre} onChange={(e) => setF("nombre", e.target.value)} />
              </div>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Categoría</div>
                <input className="input" value={form.categoria} onChange={(e) => setF("categoria", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Presentación</div>
                <input className="input" value={form.presentacion} onChange={(e) => setF("presentacion", e.target.value)} />
              </div>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Código</div>
                <input className="input" value={form.codigo} onChange={(e) => setF("codigo", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Costo</div>
                <input className="input" inputMode="numeric" value={form.costo} onChange={(e) => setF("costo", e.target.value)} />
              </div>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Precio</div>
                <input className="input" inputMode="numeric" value={form.precio_venta} onChange={(e) => setF("precio_venta", e.target.value)} />
              </div>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>Stock mínimo</div>
                <input className="input" inputMode="numeric" value={form.stock_minimo} onChange={(e) => setF("stock_minimo", e.target.value)} />
              </div>
            </div>

            {err && <div style={{ color: "crimson", fontWeight: 800 }}>{err}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btnAccent" disabled={saving} onClick={guardar}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                className="btnAccent"
                style={{ background: "#64748b" }}
                onClick={() => setEdit(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {err && !edit && <div style={{ marginTop: 10, color: "crimson", fontWeight: 800 }}>{err}</div>}
    </div>
  );
}