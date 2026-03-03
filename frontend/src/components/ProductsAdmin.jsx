import { useEffect, useMemo, useState } from "react";
import ProductCard from "./ProductCard";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ProductsAdmin() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  async function load() {
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/productos`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setMsg("No se pudo cargar productos.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onUpdated(prod) {
   
    setList((prev) => prev.map((x) => (x.id === prod.id ? prod : x)));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = list;

    if (q) {
      arr = arr.filter((p) => {
        const a = (p.nombre ?? "").toLowerCase();
        const b = (p.codigo ?? "").toLowerCase();
        const c = (p.categoria ?? "").toLowerCase();
        const d = (p.presentacion ?? "").toLowerCase();
        return a.includes(q) || b.includes(q) || c.includes(q) || d.includes(q);
      });
    }

    if (onlyLow) {
      arr = arr.filter((p) => Number(p.stock) <= Number(p.stock_minimo));
    }

  
    return [...arr].sort((x, y) => {
      const xl = Number(x.stock) <= Number(x.stock_minimo);
      const yl = Number(y.stock) <= Number(y.stock_minimo);
      if (xl !== yl) return xl ? -1 : 1;
      return (x.nombre ?? "").localeCompare(y.nombre ?? "");
    });
  }, [list, search, onlyLow]);

  return (
    <div>
      <div
        className="panel"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: "var(--text)" }}>Buscar / filtrar</div>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, categoría, presentación, código..."
          />
          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text)", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={onlyLow}
                onChange={(e) => setOnlyLow(e.target.checked)}
              />
              Mostrar solo bajo stock
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btnAccent" disabled={loading} onClick={load} style={{ background: "var(--brand)" }}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ marginBottom: 12, color: "crimson", fontWeight: 800 }}>
          {msg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="panel" style={{ color: "var(--muted)" }}>
          No hay productos para mostrar.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}