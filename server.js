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

// Función de mes unificada para evitar errores de coincidencia
const getMesActual = () => {
    return new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })
        .toLowerCase()
        .trim();
};

// --- RUTA 1: ESTADO DE PAGOS (ADMIN) ---
app.get('/api/pagos-estado', async (req, res) => {
  try {
    const mesActual = getMesActual();
    const query = `
      SELECT 
        c.id_cliente, c.nombre_cliente, c.monto_usd, c.monto_ars, 
        p.estado, p.monto as monto_pagado, p.forma_pago
      FROM clientes c
      LEFT JOIN pagos p ON c.id_cliente = p.id_cliente 
      AND p.mes_referencia = $1
      WHERE c.activo = true
    `;
    const { rows } = await pool.query(query, [mesActual]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RUTA 2: REGISTRAR PAGO (Corregida la columna 'monto') ---
app.post('/api/registrar-pago', async (req, res) => {
  const { id_cliente, monto, forma_pago } = req.body;
  const mesActual = getMesActual();
  
  try {
    // IMPORTANTE: Cambié 'monto_abonado' por 'monto' para que coincida con tu DB
    const query = `
      INSERT INTO pagos (id_cliente, monto, fecha_pago, mes_referencia, forma_pago, estado)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pagado')
      RETURNING *;
    `;
    await pool.query(query, [id_cliente, monto, mesActual, forma_pago]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error en DB:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- NUEVA RUTA: CALENDARIO DE TAREAS ---
app.get('/api/tareas', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tareas ORDER BY fecha_ejecucion ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tareas', async (req, res) => {
    const { id_cliente, asignado_a, tipo_tarea, detalle_pauta, fecha } = req.body;
    try {
        const query = `
            INSERT INTO tareas (id_cliente, asignado_a, tipo_tarea, detalle_tarea, fecha_ejecucion)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        await pool.query(query, [id_cliente, asignado_a, tipo_tarea, JSON.stringify(detalle_pauta), fecha]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRM running on port ${PORT}`);
});