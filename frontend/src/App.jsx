import { useState } from "react";
import Tabs from "./components/Tabs";
import PosView from "./components/PosView";
import ProductosView from "./components/ProductosView";
import SalesView from "./components/SalesView";
import ProductsAdmin from "./components/ProductsAdmin";
import "./App.css";

export default function App() {
  const [tab, setTab] = useState("pos");

  const items = [
    { key: "pos", label: "POS" },
    { key: "productos", label: "Productos" },
    { key: "ventas", label: "Ventas" },
  ];

  return (
    <div className="container">
      <h1 className="title">Rubio POS</h1>

      <Tabs tab={tab} onChange={setTab} items={items} />

      {tab === "pos" && <PosView />}

      {tab === "productos" && (
        <div className="productsLayout">
          <ProductsAdmin />
          <div className="productsRight">
            <ProductosView />
          </div>
        </div>
      )}

      {tab === "ventas" && <SalesView />}
    </div>
  );
}