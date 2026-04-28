const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const getMesActual = () => {
    return new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })
        .toLowerCase().trim();
};

// --- CLIENTES ---
app.get('/api/clientes', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM clientes WHERE activo = true ORDER BY nombre_cliente ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes', async (req, res) => {
    const { id_cliente, nombre_cliente, monto_usd, monto_ars, user_ig, pass_ig, descripcion } = req.body;
    try {
        await pool.query(
            `INSERT INTO clientes (id_cliente, nombre_cliente, monto_usd, monto_ars, user_ig, pass_ig, descripcion, activo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
            [id_cliente, nombre_cliente, monto_usd, monto_ars, user_ig, pass_ig, descripcion]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clientes/:id', async (req, res) => {
    try {
        await pool.query('UPDATE clientes SET activo = false WHERE id_cliente = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- COBRANZAS ---
app.get('/api/pagos-estado', async (req, res) => {
  try {
    const mesActual = getMesActual();
    const query = `
      SELECT c.*, p.estado, p.monto as monto_pagado
      FROM clientes c
      LEFT JOIN pagos p ON c.id_cliente = p.id_cliente AND p.mes_referencia = $1
      WHERE c.activo = true
      ORDER BY c.nombre_cliente ASC
    `;
    const { rows } = await pool.query(query, [mesActual]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/registrar-pago', async (req, res) => {
  const { id_cliente, monto, forma_pago } = req.body;
  const mesActual = getMesActual();
  try {
    await pool.query(
      `INSERT INTO pagos (id_cliente, monto, fecha_pago, mes_referencia, forma_pago, estado)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pagado')`,
      [id_cliente, monto, mesActual, forma_pago]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- NUEVA RUTA: HISTORIAL COMPLETO DE PAGOS ---
app.get('/api/pagos', async (req, res) => {
    try {
        const query = `
            SELECT p.*, c.nombre_cliente 
            FROM pagos p 
            JOIN clientes c ON p.id_cliente = c.id_cliente 
            ORDER BY p.fecha_pago DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});


// --- TAREAS (CALENDARIO) ---
app.get('/api/tareas', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tareas ORDER BY fecha_ejecucion ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tareas', async (req, res) => {
    const { id_cliente, asignado_a, tipo_tarea, detalle_tarea, fecha } = req.body;
    try {
        await pool.query(
            `INSERT INTO tareas (id_cliente, asignado_a, tipo_tarea, detalle_tarea, fecha_ejecucion)
             VALUES ($1, $2, $3, $4, $5)`,
            [id_cliente, asignado_a, tipo_tarea, JSON.stringify(detalle_tarea), fecha]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.delete('/api/tareas/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tareas WHERE id_tarea = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- RUTA: ESTADÍSTICAS FINANCIERAS ---
app.get('/api/stats-financieras', async (req, res) => {
    try {
        const query = `
            SELECT 
                mes_referencia, 
                SUM(monto) as total_cobrado,
                COUNT(*) as cantidad_pagos
            FROM pagos 
            GROUP BY mes_referencia 
            ORDER BY MIN(fecha_pago) ASC 
            LIMIT 12
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ESTO SIEMPRE AL FINAL
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`CRM SENE running on port ${PORT}`));