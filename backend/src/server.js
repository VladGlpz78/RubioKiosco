const express = require("express");
const cors = require("cors");
const db = require("./db"); 

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/productos/buscar", (req, res) => {
  const q = (req.query.q ?? "").toString().trim();
  if (!q) return res.json([]);

  const rows = db.prepare(`
    SELECT *
    FROM productos
    WHERE activo = 1
      AND (nombre LIKE ? OR IFNULL(codigo,'') LIKE ?)
    ORDER BY nombre ASC
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`);

  res.json(rows);
});


app.get("/productos", (req, res) => {
  const inactivos = String(req.query.inactivos || "") === "1";

  const rows = inactivos
    ? db.prepare("SELECT * FROM productos ORDER BY id DESC").all()
    : db.prepare("SELECT * FROM productos WHERE activo = 1 ORDER BY id DESC").all();

  res.json(rows); 
});


app.post("/productos", (req, res) => {
  const {
    nombre,
    categoria = "General",
    presentacion = null,
    unidad_medida = "un",
    contenido = null,
    codigo = null,
    costo,
    precio_venta,
    stock = 0,
    stock_minimo = 0
  } = req.body;

  if (!nombre || costo == null || precio_venta == null) {
    return res.status(400).json({ error: "Faltan datos: nombre, costo, precio_venta" });
  }

  const exists = db
    .prepare(
      "SELECT id FROM productos WHERE nombre = ? AND IFNULL(presentacion,'') = IFNULL(?, '')"
    )
    .get(nombre, presentacion);

  if (exists) {
    return res.status(409).json({
      error: "Ese producto ya existe (mismo nombre y presentación)."
    });
  }

  const stmt = db.prepare(`
    INSERT INTO productos
    (nombre, categoria, presentacion, unidad_medida, contenido, codigo, costo, precio_venta, stock, stock_minimo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    nombre,
    categoria,
    presentacion,
    unidad_medida,
    contenido,
    codigo,
    costo,
    precio_venta,
    stock,
    stock_minimo
  );

  const created = db.prepare("SELECT * FROM productos WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(created);
});


app.patch("/productos/:id/stock", (req, res) => {
  const id = Number(req.params.id);
  const { delta } = req.body;

  if (!Number.isFinite(delta)) {
    return res.status(400).json({ error: "Falta delta (número). Ej: { delta: 5 }" });
  }

  const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });

  const newStock = prod.stock + delta;
  if (newStock < 0) {
    return res.status(400).json({ error: "Stock no puede quedar negativo" });
  }

  db.prepare("UPDATE productos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(
    newStock,
    id
  );

  const updated = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  res.json(updated);
});


app.post("/ventas", (req, res) => {
  const { metodo_pago = "efectivo", items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items debe ser un array con al menos 1 producto" });
  }

  
  const map = new Map();
  for (const it of items) {
    const pid = Number(it.producto_id);
    const cant = Number(it.cantidad);

    if (!Number.isFinite(pid) || !Number.isFinite(cant) || cant <= 0) {
      return res.status(400).json({
        error: "Item inválido: producto_id y cantidad deben ser números > 0"
      });
    }

    map.set(pid, (map.get(pid) ?? 0) + cant);
  }

  const normalizedItems = Array.from(map.entries()).map(([producto_id, cantidad]) => ({
    producto_id,
    cantidad
  }));

 
  const trx = db.transaction((metodo_pago, normalizedItems) => {
   
    for (const { producto_id, cantidad } of normalizedItems) {
      const prod = db.prepare("SELECT id, nombre, stock FROM productos WHERE id = ?").get(producto_id);
      if (!prod) throw new Error(`Producto no existe (id ${producto_id})`);
      if (prod.stock < cantidad) {
        throw new Error(`Stock insuficiente para ${prod.nombre}. Stock: ${prod.stock}, pedido: ${cantidad}`);
      }
    }

   
    const ventaInfo = db
      .prepare("INSERT INTO ventas (metodo_pago, total) VALUES (?, 0)")
      .run(metodo_pago);

    const ventaId = ventaInfo.lastInsertRowid;

    let totalVenta = 0;

    for (const { producto_id, cantidad } of normalizedItems) {
      const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(producto_id);

      const precio_unitario = prod.precio_venta;
      const subtotal = precio_unitario * cantidad;

      
      db.prepare(`
        INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `).run(ventaId, producto_id, cantidad, precio_unitario, subtotal);

      db.prepare(`
        UPDATE productos
        SET stock = stock - ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(cantidad, producto_id);

      totalVenta += subtotal;
    }


    db.prepare("UPDATE ventas SET total = ? WHERE id = ?").run(totalVenta, ventaId);

    return { ventaId, totalVenta };
  });

  try {
    const { ventaId, totalVenta } = trx(metodo_pago, normalizedItems);

    const venta = db.prepare("SELECT * FROM ventas WHERE id = ?").get(ventaId);
    const detalles = db
      .prepare(
        `
        SELECT dv.*, p.nombre, p.presentacion
        FROM detalle_ventas dv
        JOIN productos p ON p.id = dv.producto_id
        WHERE dv.venta_id = ?
        ORDER BY dv.id ASC
      `
      )
      .all(ventaId);

    res.status(201).json({ venta, detalles, totalVenta });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.get("/productos/:id", (req, res) => {
  const id = Number(req.params.id);
  const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(prod);
});


app.put("/productos/:id", (req, res) => {
  const id = Number(req.params.id);

  const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });

  const {
    nombre = prod.nombre,
    categoria = prod.categoria,
    presentacion = prod.presentacion,
    unidad_medida = prod.unidad_medida,
    contenido = prod.contenido,
    codigo = prod.codigo,
    costo = prod.costo,
    precio_venta = prod.precio_venta,
    stock = prod.stock,
    stock_minimo = prod.stock_minimo
  } = req.body;

  if (!nombre || costo == null || precio_venta == null) {
    return res.status(400).json({ error: "Faltan datos: nombre, costo, precio_venta" });
  }

  
  const dup = db.prepare(`
    SELECT id FROM productos
    WHERE nombre = ?
      AND IFNULL(presentacion,'') = IFNULL(?, '')
      AND id <> ?
  `).get(nombre, presentacion, id);

  if (dup) {
    return res.status(409).json({ error: "Ya existe otro producto con ese nombre y presentación" });
  }

  db.prepare(`
    UPDATE productos
    SET nombre=?, categoria=?, presentacion=?, unidad_medida=?, contenido=?, codigo=?,
        costo=?, precio_venta=?, stock=?, stock_minimo=?,
        updated_at=datetime('now')
    WHERE id=?
  `).run(
    nombre, categoria, presentacion, unidad_medida, contenido, codigo,
    costo, precio_venta, stock, stock_minimo,
    id
  );

  const updated = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  res.json(updated);
});


app.patch("/productos/:id/desactivar", (req, res) => {
  const id = Number(req.params.id);

  const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });

  db.prepare(`
    UPDATE productos
    SET activo = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  const updated = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  res.json(updated);
});


app.patch("/productos/:id/reactivar", (req, res) => {
  const id = Number(req.params.id);

  const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  if (!prod) return res.status(404).json({ error: "Producto no encontrado" });

  db.prepare(`
    UPDATE productos
    SET activo = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  const updated = db.prepare("SELECT * FROM productos WHERE id = ?").get(id);
  res.json(updated);
});



app.get("/ventas", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        v.*,
        (SELECT IFNULL(SUM(dv.cantidad), 0)
         FROM detalle_ventas dv
         WHERE dv.venta_id = v.id) AS items_total
      FROM ventas v
      ORDER BY v.anulada ASC, v.id DESC
      `
    )
    .all();

  res.json(rows);
});


app.get("/ventas/:id", (req, res) => {
  const id = Number(req.params.id);

  const venta = db.prepare("SELECT * FROM ventas WHERE id = ?").get(id);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

  const detalles = db
    .prepare(
      `
      SELECT dv.*, p.nombre, p.presentacion
      FROM detalle_ventas dv
      JOIN productos p ON p.id = dv.producto_id
      WHERE dv.venta_id = ?
      ORDER BY dv.id ASC
    `
    )
    .all(id);

  res.json({ venta, detalles });
});


app.get("/reportes/resumen", (req, res) => {
  const { desde, hasta } = req.query;

  if (!desde || !hasta) {
    return res.status(400).json({ error: "Usá ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD" });
  }

  const totalVendido = db
    .prepare(
      `
      SELECT IFNULL(SUM(total), 0) as total
      FROM ventas
      WHERE date(fecha) BETWEEN date(?) AND date(?)
        AND anulada = 0
      `
    )
    .get(desde, hasta).total;

  const calc = db
    .prepare(
      `
      SELECT
        IFNULL(SUM(p.costo * dv.cantidad), 0) AS reposicion,
        IFNULL(SUM((dv.precio_unitario - p.costo) * dv.cantidad), 0) AS ganancia
      FROM detalle_ventas dv
      JOIN ventas v ON v.id = dv.venta_id
      JOIN productos p ON p.id = dv.producto_id
      WHERE date(v.fecha) BETWEEN date(?) AND date(?)
        AND v.anulada = 0
      `
    )
    .get(desde, hasta);

  res.json({
    desde,
    hasta,
    total_vendido: totalVendido,
    plata_reposicion: calc.reposicion,
    ganancia: calc.ganancia
  });
});



app.post("/ventas/:id/anular", (req, res) => {
  const id = Number(req.params.id);

  const trx = db.transaction(() => {
    const venta = db.prepare("SELECT * FROM ventas WHERE id = ?").get(id);
    if (!venta) throw new Error("Venta no encontrada");
    if (Number(venta.anulada) === 1) {
  throw new Error("La venta ya está anulada");
}
   
    const items = db
      .prepare("SELECT producto_id, cantidad FROM detalle_ventas WHERE venta_id = ?")
      .all(id);

    if (items.length === 0) throw new Error("La venta no tiene items");

  
    const upStock = db.prepare(`
      UPDATE productos
      SET stock = stock + ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    for (const it of items) {
      upStock.run(it.cantidad, it.producto_id);
    }

    
    db.prepare(`
      UPDATE ventas
      SET anulada = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    return true;
  });

  try {
    trx();

    const venta = db.prepare("SELECT * FROM ventas WHERE id = ?").get(id);
    const detalles = db
      .prepare(`
        SELECT dv.*, p.nombre, p.presentacion
        FROM detalle_ventas dv
        JOIN productos p ON p.id = dv.producto_id
        WHERE dv.venta_id = ?
        ORDER BY dv.id ASC
      `)
      .all(id);

    res.json({ ok: true, venta, detalles });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
const path = require("path");

app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));