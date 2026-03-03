import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function PosView() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quick, setQuick] = useState({
    nombre: "",
    categoria: "Limpieza",
    presentacion: "1L",
    costo: "",
    precio_venta: "",
    stock: 0,
    stock_minimo: 0,
  });

  useEffect(() => {
    const t = setTimeout(async () => {
      const query = q.trim();
      setQuick((prev) => ({ ...prev, nombre: query }));

      if (!query) {
        setResults([]);
        setShowQuickAdd(false);
        return;
      }

      try {
        const res = await fetch(`${API}/productos/buscar?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  const total = useMemo(
    () => cart.reduce((acc, it) => acc + it.precio_venta * it.cantidad, 0),
    [cart]
  );

  function addToCart(p) {
    setCart((prev) => {
      const found = prev.find((x) => x.producto_id === p.id);
      if (found) {
        return prev.map((x) =>
          x.producto_id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x
        );
      }
      return [
        ...prev,
        {
          producto_id: p.id,
          nombre: p.nombre,
          presentacion: p.presentacion,
          precio_venta: p.precio_venta,
          cantidad: 1,
        },
      ];
    });
  }

  function inc(pid) {
    setCart((prev) =>
      prev.map((x) => (x.producto_id === pid ? { ...x, cantidad: x.cantidad + 1 } : x))
    );
  }

  function dec(pid) {
    setCart((prev) =>
      prev
        .map((x) => (x.producto_id === pid ? { ...x, cantidad: x.cantidad - 1 } : x))
        .filter((x) => x.cantidad > 0)
    );
  }

  async function crearProductoRapido() {
    setMsg("");

    const nombre = quick.nombre.trim();
    if (!nombre) return setMsg("Nombre inválido.");

    const payload = {
      nombre,
      categoria: (quick.categoria || "Limpieza").trim(),
      presentacion: (quick.presentacion || "").trim() || null,
      unidad_medida: "un",
      contenido: null,
      codigo: null,
      costo: Number(quick.costo),
      precio_venta: Number(quick.precio_venta),
      stock: Number(quick.stock || 0),
      stock_minimo: Number(quick.stock_minimo || 0),
    };

    if (!Number.isFinite(payload.costo) || !Number.isFinite(payload.precio_venta)) {
      return setMsg("Costo y precio deben ser números.");
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error || "No se pudo crear el producto.");
        return;
      }

      addToCart(data);

      setShowQuickAdd(false);
      setQ("");
      setResults([]);
      setQuick((prev) => ({ ...prev, costo: "", precio_venta: "" }));
      setMsg(`Producto creado: ${data.nombre}`);
    } catch {
      setMsg("No se pudo conectar con el backend.");
    } finally {
      setLoading(false);
    }
  }

  async function cobrar() {
    setMsg("");
    if (cart.length === 0) return setMsg("El carrito está vacío.");
    setLoading(true);

    try {
      const payload = {
        metodo_pago: metodoPago,
        items: cart.map((x) => ({ producto_id: x.producto_id, cantidad: x.cantidad })),
      };

      const res = await fetch(`${API}/ventas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || "Error al cobrar.");
        return;
      }

      setMsg(`Venta #${data.venta.id} registrada. Total: $${data.venta.total}`);
      setCart([]);
      setQ("");
      setResults([]);
      setShowQuickAdd(false);
    } catch {
      setMsg("No se pudo conectar con el backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid">
      {/* Panel búsqueda */}
      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ width: "100%" }}>
            <div style={{ fontWeight: 900, color: "var(--text)" }}>Buscar producto</div>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: detergente, espiral..."
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <div style={{ fontWeight: 900, color: "var(--text)" }}>Método de pago</div>
            <select
              className="select"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
        </div>

        
        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          {q.trim() && results.length === 0 && (
            <div style={{ padding: 12 }}>
              <div style={{ color: "var(--muted)", marginBottom: 10 }}>Sin resultados.</div>

              <button className="btnAccent" onClick={() => setShowQuickAdd(true)}>
                Crear producto "{q.trim()}"
              </button>

              {showQuickAdd && (
                <div
                  style={{
                    marginTop: 12,
                    background: "rgba(255,255,255,0.75)",
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "var(--text)" }}>Nombre</div>
                      <input
                        className="input"
                        value={quick.nombre}
                        onChange={(e) => setQuick({ ...quick, nombre: e.target.value })}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "var(--text)" }}>Categoría</div>
                        <input
                          className="input"
                          value={quick.categoria}
                          onChange={(e) => setQuick({ ...quick, categoria: e.target.value })}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, color: "var(--text)" }}>Presentación</div>
                        <input
                          className="input"
                          value={quick.presentacion}
                          onChange={(e) => setQuick({ ...quick, presentacion: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "var(--text)" }}>Costo</div>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={quick.costo}
                          onChange={(e) => setQuick({ ...quick, costo: e.target.value })}
                          placeholder="Ej: 800"
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, color: "var(--text)" }}>Precio venta</div>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={quick.precio_venta}
                          onChange={(e) => setQuick({ ...quick, precio_venta: e.target.value })}
                          placeholder="Ej: 1200"
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "var(--text)" }}>Stock inicial</div>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={quick.stock}
                          onChange={(e) => setQuick({ ...quick, stock: e.target.value })}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, color: "var(--text)" }}>Stock mínimo</div>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={quick.stock_minimo}
                          onChange={(e) => setQuick({ ...quick, stock_minimo: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button className="btnAccent" disabled={loading} onClick={crearProductoRapido}>
                        {loading ? "Creando..." : "Guardar y agregar"}
                      </button>

                      <button
                        className="btnAccent"
                        style={{ background: "#64748b" }}
                        onClick={() => setShowQuickAdd(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {results.map((p) => (
            <div className="resultRow" key={p.id}>
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>
                  {p.nombre} {p.presentacion ? `(${p.presentacion})` : ""}
                </div>
                <div className="mini">Stock: {p.stock} — Precio: ${p.precio_venta}</div>
              </div>

              <button className="btnAccent" onClick={() => addToCart(p)}>
                Agregar
              </button>
            </div>
          ))}
        </div>
      </div>


      <div className="panel">
        <h3 style={{ marginTop: 0, color: "var(--text)" }}>Carrito</h3>

        {cart.length === 0 ? (
          <div style={{ color: "var(--muted)", marginBottom: 10 }}>No hay productos aún.</div>
        ) : (
          cart.map((it) => (
            <div
              key={it.producto_id}
              style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}
            >
              <div>
                <div style={{ fontWeight: 900, color: "var(--text)" }}>
                  {it.nombre} {it.presentacion ? `(${it.presentacion})` : ""}
                </div>
                <div className="mini">
                  ${it.precio_venta} x {it.cantidad} = ${it.precio_venta * it.cantidad}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  className="btnAccent"
                  onClick={() => dec(it.producto_id)}
                  style={{ padding: "6px 10px" }}
                >
                  -
                </button>
                <div style={{ minWidth: 18, textAlign: "center", color: "var(--text)", fontWeight: 900 }}>
                  {it.cantidad}
                </div>
                <button
                  className="btnAccent"
                  onClick={() => inc(it.producto_id)}
                  style={{ padding: "6px 10px" }}
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, fontWeight: 900, color: "var(--text)" }}>
          Total: ${total}
        </div>

        <button
          className="btnAccent"
          onClick={cobrar}
          disabled={loading || cart.length === 0}
          style={{ marginTop: 10, width: "100%", padding: 12 }}
        >
          {loading ? "Cobrando..." : "Cobrar"}
        </button>

        {msg && (
          <div style={{ marginTop: 10, color: msg.toLowerCase().includes("error") ? "crimson" : "green" }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}