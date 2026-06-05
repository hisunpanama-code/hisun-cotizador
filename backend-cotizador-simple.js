import express from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const inventario = {
  'Guardian 750L': { precio: 7950, colores: { 'Orange Mist': 3, 'Military Green': 2, 'Space Grey': 5 } },
  'Freelander 750 (1 fila)': { precio: 12950, colores: { 'Orange Mist': 2, 'Kanara Camo': 1 } },
  'Freelander 750 Crew': { precio: 15950, colores: { 'Orange Mist': 6, 'Jungle Green': 4, 'Ocean Blue': 3, 'Military Green': 2, 'Space Grey': 5, 'Black': 2 } },
  'Freelander EV Crew': { precio: 23950, colores: { 'Ocean Blue': 4, 'Military Green': 3, 'Space Grey': 2, 'Night Black': 1 } }
};

const htmlCotizador = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cotiza tu HISUN 2026</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); min-height: 100vh; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 50px; color: white; }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; font-weight: 700; }
    .header p { font-size: 1.1em; color: #aaa; }
    .form-section { background: white; border-radius: 12px; padding: 40px; margin-bottom: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
    .section-title { font-size: 1.5em; font-weight: 600; margin-bottom: 25px; color: #1a1a1a; border-bottom: 3px solid #ff6b35; padding-bottom: 10px; }
    .form-group { margin-bottom: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    label { display: block; font-weight: 600; margin-bottom: 8px; color: #333; }
    input, select { width: 100%; padding: 12px 15px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 1em; }
    input:focus, select:focus { outline: none; border-color: #ff6b35; }
    .modelos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .modelo-card { cursor: pointer; border: 3px solid #e0e0e0; border-radius: 10px; padding: 20px; text-align: center; background: #f9f9f9; transition: all 0.3s; }
    .modelo-card:hover { border-color: #ff6b35; box-shadow: 0 5px 20px rgba(255,107,53,0.2); }
    .modelo-card input { display: none; }
    .modelo-card.selected { border-color: #ff6b35; background: rgba(255,107,53,0.05); color: #ff6b35; font-weight: 700; }
    .modelo-precio { color: #ff6b35; font-size: 1.2em; font-weight: 700; margin-top: 10px; }
    .colores-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
    .color-option { position: relative; cursor: pointer; }
    .color-option input { display: none; }
    .color-swatch { width: 100%; aspect-ratio: 1; border-radius: 8px; border: 3px solid #ddd; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 600; font-size: 0.75em; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.3); padding: 5px; text-align: center; }
    .color-option input:checked ~ .color-swatch { border-color: #333; box-shadow: 0 0 0 3px rgba(255,107,53,0.3); }
    .color-option.sin-stock .color-swatch { opacity: 0.5; cursor: not-allowed; }
    .resumen { background: #f5f5f5; padding: 25px; border-radius: 10px; margin: 30px 0; border-left: 5px solid #ff6b35; }
    .resumen-item { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .resumen-total { border-top: 2px solid #ddd; padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; font-size: 1.3em; font-weight: 700; color: #ff6b35; }
    .button-group { display: flex; gap: 15px; justify-content: center; margin-top: 30px; }
    button { padding: 14px 40px; border: none; border-radius: 6px; font-size: 1em; font-weight: 600; cursor: pointer; text-transform: uppercase; }
    .btn-cotizar { background: linear-gradient(135deg, #ff6b35 0%, #ff5520 100%); color: white; flex: 1; max-width: 300px; }
    .btn-cotizar:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255,107,53,0.4); }
    .btn-limpiar { background: #e0e0e0; color: #333; flex: 1; max-width: 300px; }
    .success-message { background: #2ed573; color: white; padding: 15px; border-radius: 6px; margin-top: 20px; text-align: center; display: none; }
    .success-message.show { display: block; }
    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚙 Cotiza tu HISUN 2026</h1>
      <p>Completa el formulario y recibirás tu propuesta al instante</p>
    </div>

    <form id="cotizadorForm">
      <div class="form-section">
        <h2 class="section-title">Tus Datos</h2>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" id="nombre" required>
          </div>
          <div class="form-group">
            <label>Apellido *</label>
            <input type="text" id="apellido" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email *</label>
            <input type="email" id="email" required>
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="tel" id="telefono" placeholder="+507 XXXX-XXXX">
          </div>
        </div>
      </div>

      <div class="form-section">
        <h2 class="section-title">Elige tu Modelo</h2>
        <div class="modelos-grid" id="modelosGrid"></div>
      </div>

      <div class="form-section">
        <h2 class="section-title">Selecciona el Color</h2>
        <div class="colores-grid" id="coloresGrid"></div>
      </div>

      <div class="form-section">
        <div class="resumen">
          <h3>Resumen de tu Cotización</h3>
          <div class="resumen-item"><label>Modelo:</label><span id="resumen-modelo">-</span></div>
          <div class="resumen-item"><label>Color:</label><span id="resumen-color">-</span></div>
          <div class="resumen-item"><label>Precio:</label><span id="resumen-precio">$0.00</span></div>
          <div class="resumen-total"><span>Total:</span><span id="resumen-total">$0.00</span></div>
        </div>
        <div class="button-group">
          <button type="reset" class="btn-limpiar">Limpiar</button>
          <button type="submit" class="btn-cotizar">Generar Propuesta</button>
        </div>
        <div class="success-message" id="successMessage">✓ Propuesta enviada. Revisa tu correo.</div>
      </div>
    </form>
  </div>

  <script>
    const INVENTARIO = {
      'Guardian 750L': { precio: 7950, colores: { 'Orange Mist': 3, 'Military Green': 2, 'Space Grey': 5 } },
      'Freelander 750 (1 fila)': { precio: 12950, colores: { 'Orange Mist': 2, 'Kanara Camo': 1 } },
      'Freelander 750 Crew': { precio: 15950, colores: { 'Orange Mist': 6, 'Jungle Green': 4, 'Ocean Blue': 3, 'Military Green': 2, 'Space Grey': 5, 'Black': 2 } },
      'Freelander EV Crew': { precio: 23950, colores: { 'Ocean Blue': 4, 'Military Green': 3, 'Space Grey': 2, 'Night Black': 1 } }
    };

    const COLORES_HEX = {
      'Orange Mist': '#FF8C00', 'Military Green': '#556B2F', 'Space Grey': '#808080',
      'Kanara Camo': '#654321', 'Jungle Green': '#2D5016', 'Ocean Blue': '#0066CC',
      'Black': '#000000', 'Night Black': '#1a1a1a'
    };

    function mostrarModelos() {
      const grid = document.getElementById('modelosGrid');
      Object.entries(INVENTARIO).forEach(([modelo, data]) => {
        const label = document.createElement('label');
        label.className = 'modelo-card';
        label.innerHTML = \`<input type="radio" name="modelo" value="\${modelo}" required>
          <div>\${modelo}</div>
          <div class="modelo-precio">$\${data.precio.toLocaleString()}</div>\`;
        grid.appendChild(label);
      });
      document.querySelectorAll('input[name="modelo"]').forEach(r => r.addEventListener('change', actualizarColores));
    }

    function actualizarColores() {
      const modelo = document.querySelector('input[name="modelo"]:checked').value;
      const data = INVENTARIO[modelo];
      const grid = document.getElementById('coloresGrid');
      grid.innerHTML = '';
      document.getElementById('resumen-modelo').textContent = modelo;
      document.getElementById('resumen-precio').textContent = \`$\${data.precio.toLocaleString()}\`;
      
      Object.entries(data.colores).forEach(([color, stock]) => {
        const label = document.createElement('label');
        label.className = 'color-option' + (stock <= 0 ? ' sin-stock' : '');
        const hex = COLORES_HEX[color] || '#CCC';
        const txtColor = isLightColor(hex) ? '#000' : '#fff';
        label.innerHTML = \`<input type="radio" name="color" value="\${color}" \${stock <= 0 ? 'disabled' : ''} required>
          <div class="color-swatch" style="background-color: \${hex}; color: \${txtColor};">\${color}<br>\${stock}</div>\`;
        grid.appendChild(label);
      });
      document.querySelectorAll('input[name="color"]').forEach(r => r.addEventListener('change', actualizarResumen));
    }

    function isLightColor(hex) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 128;
    }

    function actualizarResumen() {
      const color = document.querySelector('input[name="color"]:checked').value;
      document.getElementById('resumen-color').textContent = color;
      document.getElementById('resumen-total').textContent = document.getElementById('resumen-precio').textContent;
    }

    document.getElementById('cotizadorForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const datos = {
        nombre: document.getElementById('nombre').value,
        apellido: document.getElementById('apellido').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        modelo: document.querySelector('input[name="modelo"]:checked').value,
        color: document.querySelector('input[name="color"]:checked').value
      };
      try {
        const response = await fetch('/api/cotizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });
        if (response.ok) {
          document.getElementById('successMessage').classList.add('show');
          setTimeout(() => {
            document.getElementById('cotizadorForm').reset();
            document.getElementById('successMessage').classList.remove('show');
            document.getElementById('coloresGrid').innerHTML = '';
          }, 3000);
        } else {
          alert('Error al enviar');
        }
      } catch (e) { alert('Error: ' + e.message); }
    });

    mostrarModelos();
  </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(htmlCotizador));
app.get('/api/inventario', (req, res) => res.json(inventario));

app.post('/api/cotizar', async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, modelo, color } = req.body;
    if (!nombre || !apellido || !email || !modelo || !color) return res.status(400).json({ error: 'Faltan datos' });
    
    const precio = inventario[modelo]?.precio;
    if (!precio) return res.status(400).json({ error: 'Modelo inválido' });

    const cotizacionId = `COT-${Date.now()}`;
    const pdf = new PDFDocument();
    let pdfData = '';
    pdf.on('data', chunk => pdfData += chunk);
    
    pdf.fontSize(20).text('COTIZACIÓN HISUN', { align: 'center' });
    pdf.fontSize(12).text(`ID: ${cotizacionId}`, { align: 'center' }).moveDown();
    pdf.fontSize(14).text('DATOS DEL CLIENTE');
    pdf.fontSize(11).text(`Nombre: ${nombre} ${apellido}`);
    pdf.text(`Email: ${email}`);
    pdf.text(`Teléfono: ${telefono || 'N/A'}`).moveDown();
    pdf.fontSize(14).text('DETALLE');
    pdf.fontSize(11).text(`Modelo: ${modelo}`);
    pdf.text(`Color: ${color}`);
    pdf.text(`Precio: $${precio.toLocaleString()}`);
    pdf.end();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Tu Cotización HISUN - ${modelo}`,
      html: `<h2>¡Gracias por tu interés en HISUN!</h2><p>Hola ${nombre},</p><p>Tu cotización para ${modelo} en color ${color}: <strong>$${precio.toLocaleString()}</strong></p>`,
      attachments: [{ filename: `cotizacion-${cotizacionId}.pdf`, content: Buffer.from(pdfData, 'binary'), contentType: 'application/pdf' }]
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, mensaje: 'Cotización enviada. Revisa tu email.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚙 SERVIDOR COTIZACIONES HISUN - Online`);
  console.log(`Puerto: ${PORT}`);
});
