export default function Tabs({ tab, onChange, items }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className="btnAccent"
            style={{
              background: active ? "var(--brand)" : "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}