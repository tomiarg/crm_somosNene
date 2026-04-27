const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a tu base de datos de Railway (Usa tu DATABASE_URL de Railway)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- RUTA 1: OBTENER ESTADO DE PAGOS (ADMIN) ---
app.get('/api/pagos-estado', async (req, res) => {
  try {
    const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    
    // Esta consulta busca todos los clientes y verifica si tienen un pago registrado este mes
    const query = `
      SELECT c.*, p.estado, p.monto_abonado
      FROM clientes c
      LEFT JOIN pagos p ON c.id_cliente = p.id_cliente 
      AND p.mes_referencia = $1
    `;
    const { rows } = await pool.query(query, [mesActual]);
    
    // Si 'estado' es null, significa que no hay registro este mes -> En la App lo pondremos ROJO
    res.json(rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// --- RUTA 2: CARGAR UN PAGO ---
app.post('/api/registrar-pago', async (req, res) => {
  const { id_cliente, monto, forma_pago } = req.body;
  const mesActual = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  
  try {
    const query = `
      INSERT INTO pagos (id_cliente, monto_abonado, fecha_pago, mes_referencia, forma_pago, estado)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, 'pagado')
      RETURNING *;
    `;
    await pool.query(query, [id_cliente, monto, mesActual, forma_pago]);
    res.json({ success: true, message: "Pago registrado y cliente en verde!" });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(process.env.PORT || 3000, () => console.log("CRM Corriendo!"));