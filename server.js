const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config(); // Buena práctica para leer el .env en local

const app = express();
app.use(cors());
app.use(express.json());

// Sirve el archivo index.html
app.use(express.static('.')); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Función para tener el mismo formato de mes siempre
const getMesActual = () => {
    return new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
};

// --- RUTA 1: OBTENER ESTADO DE PAGOS (ADMIN) ---
app.get('/api/pagos-estado', async (req, res) => {
  try {
    const mesActual = getMesActual();
    
    // Consulta mejorada: Trae info de clientes y si pagaron este mes
    const query = `
      SELECT c.id_cliente, c.nombre_cliente, c.monto_usd, c.monto_ars, p.estado, p.monto_abonado
      FROM clientes c
      LEFT JOIN pagos p ON c.id_cliente = p.id_cliente 
      AND p.mes_referencia = $1
      WHERE c.activo = true
    `;
    const { rows } = await pool.query(query, [mesActual]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- RUTA 2: CARGAR UN PAGO ---
app.post('/api/registrar-pago', async (req, res) => {
  const { id_cliente, monto, forma_pago } = req.body;
  const mesActual = getMesActual();
  
  try {
    const query = `
      INSERT INTO pagos (id_cliente, monto_abonado, fecha_pago, mes_referencia, forma_pago, estado)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pagado')
      RETURNING *;
    `;
    await pool.query(query, [id_cliente, monto, mesActual, forma_pago]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CORRECCIÓN CRUCIAL PARA RAILWAY:
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRM de Agencia corriendo en puerto ${PORT}`);
});