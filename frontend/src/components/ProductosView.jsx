import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ProductosView() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info"); 

  const [showInactivos, setShowInactivos] = useState(false);

  const [confirmState, setConfirmState] = useState({
    open: false,
    action: null, 
    id: null,
    nombre: "",
  });

  async function cargarProductos(incluirInactivos = showInactivos) {
    setLoading(true);
    setMsg("");
    setMsgType("info");

    try {
      const url = incluirInactivos ? `${API}/productos?inactivos=1` : `${API}/productos`;
      const res = await fetch(url);
      const data = await res.json();

      
      const arr = Array.isArray(data) ? data : data ? [data] : [];
      setItems(arr);
    } catch {
      setMsg("No se pudo cargar productos.");
      setMsgType("error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarProductos(showInactivos);
  }, [showInactivos]);


  function pedirDesactivar(id, nombre) {
    setConfirmState({ open: true, action: "desactivar", id, nombre });
  }

  function pedirReactivar(id, nombre) {
    setConfirmState({ open: true, action: "reactivar", id, nombre });
  }

  function cerrarModal() {
    setConfirmState({ open: false, action: null, id: null, nombre: "" });
  }

  async function ejecutarConfirmado() {
    const { action, id, nombre } = confirmState;
    cerrarModal();
    if (!id || !action) return;

    setLoading(true);
    setMsg("");
    setMsgType("info");

    try {
      const url =
        action === "desactivar"
          ? `${API}/productos/${id}/desactivar`
          : `${API}/productos/${id}/reactivar`;

      const res = await fetch(url, { method: "PATCH" });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error || "No se pudo completar la acción.");
        setMsgType("error");
        return;
      }

      if (action === "desactivar") {
        setMsg(`Producto desactivado: ${nombre}`);
        setMsgType("ok");
        await cargarProductos(showInactivos);
      } else {
        setMsg(`Producto reactivado: ${nombre}`);
        setMsgType("ok");
        await cargarProductos(showInactivos);
      }
    } catch {
      setMsg("No se pudo conectar con el backend.");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = items;
    if (!showInactivos) list = list.filter((p) => (p.activo ?? 1) === 1);

    if (!query) return list;

    return list.filter((p) => {
      const nombre = String(p.nombre ?? "").toLowerCase();
      const codigo = String(p.codigo ?? "").toLowerCase();
      const cat = String(p.categoria ?? "").toLowerCase();
      const pres = String(p.presentacion ?? "").toLowerCase();
      return (
        nombre.includes(query) ||
        codigo.includes(query) ||
        cat.includes(query) ||
        pres.includes(query)
      );
    });
  }, [items, q, showInactivos]);

  return (
    <div className="panel">
      <div className="searchBar">
        <div className="searchLeft">
          <div style={{ fontWeight: 900, color: "var(--text)" }}>Productos</div>

          <div className="searchTop">
            <input
              className="input searchInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, categoría, presentación o código..."
            />

            <div className="searchActions">
              <button className="btnAccent" onClick={() => cargarProductos(showInactivos)} disabled={loading}>
                {loading ? "..." : "Refrescar"}
              </button>
            </div>
          </div>

          <label className="checkRow">
            <input
              type="checkbox"
              checked={showInactivos}
              onChange={(e) => setShowInactivos(e.target.checked)}
            />
            <span style={{ color: "var(--text)", fontWeight: 800 }}>Ver inactivos</span>
          </label>
        </div>
      </div>

      {msg && (
        <div
          style={{
            marginTop: 10,
            color: msgType === "error" ? "crimson" : msgType === "ok" ? "green" : "var(--text)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      )}

      <div className="cardsGrid">
        {filtrados.map((p) => {
          const activo = (p.activo ?? 1) === 1;

          return (
            <div className="card" key={p.id}>
              <div className="cardHeader">
                <div className="cardTitle">
                  {p.nombre || "Sin nombre"} {p.presentacion ? `(${p.presentacion})` : ""}
                  <span className="muted">
                    Cat: {p.categoria || "General"} • Stock: {p.stock ?? 0} • Min: {p.stock_minimo ?? 0} •{" "}
                    {activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {activo ? (
                    <button className="btnDanger" onClick={() => pedirDesactivar(p.id, p.nombre)} disabled={loading}>
                      Eliminar
                    </button>
                  ) : (
                    <button className="btnOk" onClick={() => pedirReactivar(p.id, p.nombre)} disabled={loading}>
                      Reactivar
                    </button>
                  )}
                </div>
              </div>

              <div className="mini" style={{ marginTop: 10 }}>
                Costo: ${p.costo ?? 0} • Precio: ${p.precio_venta ?? 0} • Código: {p.codigo || "—"}
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <div style={{ marginTop: 14, color: "var(--muted)" }}>No hay productos para mostrar.</div>
      )}

      {confirmState.open && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div style={{ fontWeight: 1000, fontSize: 18, color: "var(--text)" }}>
              {confirmState.action === "desactivar" ? "Desactivar producto" : "Reactivar producto"}
            </div>

            <div style={{ marginTop: 8, color: "var(--muted)", lineHeight: 1.35 }}>
              {confirmState.action === "desactivar" ? (
                <>
                  Vas a dejar de vender:{" "}
                  <b style={{ color: "var(--text)" }}>{confirmState.nombre}</b>.
                  <br />
                  No se borra, queda como <b>inactivo</b> y podés reactivarlo después.
                </>
              ) : (
                <>
                  Vas a reactivar:{" "}
                  <b style={{ color: "var(--text)" }}>{confirmState.nombre}</b>.
                </>
              )}
            </div>

            <div className="modalActions">
              <button className="btnSecondary" onClick={cerrarModal} disabled={loading}>
                Cancelar
              </button>

              <button
                className={confirmState.action === "desactivar" ? "btnDanger" : "btnOk"}
                onClick={ejecutarConfirmado}
                disabled={loading}
              >
                {loading ? "Procesando..." : confirmState.action === "desactivar" ? "Desactivar" : "Reactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}