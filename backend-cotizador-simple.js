const express = require('express');
const cors = require('cors');
const { PDFDocument, rgb } = require('pdfkit');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = '1tdkPp_e76PRCJU2R8BGSkndUU6CjKzP8eui5yi72ywk';
const GOOGLE_API_KEY = 'AIzaSyDyWY3oy5pZq1XyXzpz0K0xZ0xZ0xZ0xZ0'; // Necesitarás tu propia key

app.use(express.json());
app.use(cors());

// Configurar email
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Leer datos de Google Sheets
async function getSheetData(sheetName) {
  try {
    const range = `'${sheetName}'!A:B`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error(`Error leyendo ${sheetName}:`, error);
    return [];
  }
}

// Obtener precios y colores
async function getInventario() {
  const modelos = [
    'Guardian 750L',
    'Freelander 750 (1 fila)',
    'Freelander 750 Crew',
    'Freelander EV Crew'
  ];

  const inventario = {};

  for (const modelo of modelos) {
    const datos = await getSheetData(modelo);
    if (datos.length > 0) {
      const precio = datos[0][1]; // Primera fila tiene el precio
      const colores = {};
      
      // Leer colores desde la fila 3 en adelante (fila 1=precio, fila 2=headers)
      for (let i = 2; i < datos.length; i++) {
        if (datos[i][0] && datos[i][1]) {
          colores[datos[i][0]] = parseInt(datos[i][1]) || 0;
        }
      }

      inventario[modelo] = {
        precio: parseInt(precio) || 0,
        colores: colores
      };
    }
  }

  return inventario;
}

// API: Obtener inventario actual
app.get('/api/inventario', async (req, res) => {
  try {
    const inventario = await getInventario();
    res.json(inventario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Cotizar
app.post('/api/cotizar', async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, modelo, color } = req.body;

    // Validar que tiene todos los datos
    if (!nombre || !apellido || !email || !modelo || !color) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Obtener inventario actual
    const inventario = await getInventario();
    
    if (!inventario[modelo]) {
      return res.status(400).json({ error: 'Modelo no válido' });
    }

    const modeloData = inventario[modelo];
    if (!modeloData.colores[color]) {
      return res.status(400).json({ error: 'Color no disponible' });
    }

    const stock = modeloData.colores[color];
    if (stock <= 0) {
      return res.status(400).json({ error: 'Color sin stock' });
    }

    const precio = modeloData.precio;
    const cotizacionId = `COT-${Date.now()}`;

    // Generar PDF
    const pdf = new PDFDocument();
    let pdfData = '';

    pdf.on('data', chunk => {
      pdfData += chunk;
    });

    pdf.fontSize(20).text('COTIZACIÓN HISUN', { align: 'center' });
    pdf.fontSize(12).text(`ID: ${cotizacionId}`, { align: 'center' });
    pdf.moveDown();

    pdf.fontSize(14).text('DATOS DEL CLIENTE');
    pdf.fontSize(11).text(`Nombre: ${nombre} ${apellido}`);
    pdf.text(`Email: ${email}`);
    pdf.text(`Teléfono: ${telefono || 'N/A'}`);
    pdf.moveDown();

    pdf.fontSize(14).text('DETALLE DE LA COTIZACIÓN');
    pdf.fontSize(11).text(`Modelo: ${modelo}`);
    pdf.text(`Color: ${color}`);
    pdf.text(`Precio: $${precio.toLocaleString()}`);
    pdf.moveDown();

    pdf.fontSize(10).text('Esta es una cotización válida. Contáctenos para más información.');
    pdf.end();

    // Enviar email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Tu Cotización HISUN - ${modelo}`,
      html: `
        <h2>¡Gracias por tu interés en HISUN!</h2>
        <p>Hola ${nombre},</p>
        <p>Te adjuntamos tu cotización para el modelo <strong>${modelo}</strong> en color <strong>${color}</strong>.</p>
        <p><strong>Precio: $${precio.toLocaleString()}</strong></p>
        <p>Si tienes preguntas, no dudes en contactarnos.</p>
        <p>¡Saludos!</p>
      `,
      attachments: [
        {
          filename: `cotizacion-${cotizacionId}.pdf`,
          content: Buffer.from(pdfData, 'binary'),
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      cotizacionId: cotizacionId,
      mensaje: 'Cotización enviada. Revisa tu email.'
    });

  } catch (error) {
    console.error('Error en cotización:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('✅ Servidor HISUN Cotizador Online');
});

app.listen(PORT, () => {
  console.log(`🚙 SERVIDOR COTIZACIONES HISUN - Online`);
  console.log(`Puerto: ${PORT}`);
});
