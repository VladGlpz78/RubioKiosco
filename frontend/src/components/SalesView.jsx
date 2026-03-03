import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function isoDateLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SalesView() {
  const [ventas, setVentas] = useState([]);
  const [selected, setSelected] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [desde, setDesde] = useState(isoDateLocal());
  const [hasta, setHasta] = useState(isoDateLocal());
  const [resumen, setResumen] = useState(null);

  async function loadVentas() {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/ventas`);
      const data = await res.json();
      setVentas(Array.isArray(data) ? data : []);
    } catch {
      setMsg("No se pudo cargar el historial de ventas.");
      setVentas([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadResumen(d, h) {
    try {
      const res = await fetch(
        `${API}/reportes/resumen?desde=${encodeURIComponent(d)}&hasta=${encodeURIComponent(h)}`
      );
      const data = await res.json();
      if (!res.ok) return;
      setResumen(data);
    } catch {
    }
  }

  useEffect(() => {
    loadVentas();
  }, []);

  useEffect(() => {
    loadResumen(desde, hasta);
  }, [desde, hasta]);

  async function openVenta(id) {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/ventas/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "No se pudo abrir la venta.");
        return;
      }
      setSelected(data);
    } catch {
      setMsg("No se pudo conectar con el backend.");
    } finally {
      setLoading(false);
    }
  }

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      const f = (v.fecha || "").slice(0, 10);
      return (!desde || f >= desde) && (!hasta || f <= hasta);
    });
  }, [ventas, desde, hasta]);

  return (
    <div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="salesHeader">
          <div className="salesFilters">
            <div>
              <div className="fieldTitle">Desde</div>
              <input
                className="input"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div>
              <div className="fieldTitle">Hasta</div>
              <input
                className="input"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          <div className="salesActions">
            <button
              className="btnAccent"
              style={{ background: "var(--brand)", height: 44 }}
              disabled={loading}
              onClick={loadVentas}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        {resumen && (
          <div className="salesPills">
            <div className="pill">Vendido: ${resumen.total_vendido}</div>
            <div className="pill">Reposición: ${resumen.plata_reposicion}</div>
            <div className="pill ok">Ganancia: ${resumen.ganancia}</div>
          </div>
        )}
      </div>

      {msg && (
        <div style={{ marginBottom: 12, color: "crimson", fontWeight: 800 }}>
          {msg}
        </div>
      )}

      <div className="salesGrid">
        <div>
          {ventasFiltradas.length === 0 ? (
            <div className="panel" style={{ color: "var(--muted)" }}>
              No hay ventas en ese rango.
            </div>
          ) : (
            <div className="salesList">
              {ventasFiltradas.map((v) => {
                const anulada = Number(v.anulada || 0) === 1;
                return (
                  <button
                    key={v.id}
                    onClick={() => openVenta(v.id)}
                    className="card saleCardBtn"
                    disabled={loading}
                  >
                    <div className="saleCardHead">
                      <div className="saleCardTitle">
                        Venta #{v.id}
                        {anulada && <span className="saleIsAnulada">ANULADA</span>}
                        <div className="saleCardMeta">
                          {v.fecha} • {v.metodo_pago} • items: {v.items_total}
                        </div>
                      </div>

                      <div className="saleTotal">${v.total}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div style={{ fontWeight: 900, color: "var(--text)", marginBottom: 10 }}>
            Detalle
          </div>

          {!selected ? (
            <div style={{ color: "var(--muted)" }}>
              Seleccioná una venta para ver sus items.
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 900, color: "var(--text)" }}>
                Venta #{selected.venta.id} — ${selected.venta.total}
              </div>

              <div className="mini" style={{ marginBottom: 10 }}>
                {selected.venta.fecha} • {selected.venta.metodo_pago}
                {Number(selected.venta.anulada || 0) === 1 ? " • ANULADA" : ""}
              </div>

              <div
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                {selected.detalles.map((d) => (
                  <div key={d.id} className="resultRow">
                    <div>
                      <div style={{ fontWeight: 900, color: "var(--text)" }}>
                        {d.nombre} {d.presentacion ? `(${d.presentacion})` : ""}
                      </div>
                      <div className="mini">
                        ${d.precio_unitario} x {d.cantidad} = ${d.subtotal}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="btnAccent"
                style={{ marginTop: 10, width: "100%", background: "#64748b" }}
                onClick={() => setSelected(null)}
              >
                Cerrar detalle
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}