const express = require('express');
const cors = require('cors');
const { Client } = require('@hubapi/api-client');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const hubspotClient = new Client({ accessToken: HUBSPOT_API_KEY });

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

const PRECIOS = {
  'Freelander EV Crew': 32000,
  'Guardian 750L': 18500,
  'Freelander 750 (1 fila)': 15800,
  'Freelander 750 Crew': 19200
};

app.use(express.json());
app.use(cors());

function generarPDFCotizacion(nombre, apellido, email, modelo, color, precio, fechaExp, dealId) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ bufferPages: true, margin: 40 });
      let buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.font('Helvetica-Bold', 24).text('HISUN PANAMÁ', 40, 50);
      doc.font('Helvetica', 11).text('Propuesta de Venta - Preventa 2026', 40, 80);
      
      doc.moveTo(40, 95).lineTo(555, 95).stroke('#ff6b35');
      
      doc.font('Helvetica-Bold', 12).text('Datos del Cliente', 40, 110);
      doc.font('Helvetica', 10)
        .text(`Nombre: ${nombre} ${apellido}`, 40, 130)
        .text(`Email: ${email}`, 40, 145);

      doc.font('Helvetica-Bold', 12).text('Detalles de la Cotización', 40, 170);
      
      const tableTop = 195;
      const col1 = 40, col2 = 350;
      
      doc.font('Helvetica-Bold', 10)
        .text('Concepto', col1, tableTop)
        .text('Detalle', col2, tableTop);
      
      doc.moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).stroke();
      
      const rowHeight = 20;
      let y = tableTop + 20;
      
      doc.font('Helvetica', 10)
        .text('Modelo', col1, y)
        .text(modelo, col2, y);
      
      y += rowHeight;
      doc.text('Color', col1, y).text(color, col2, y);
      
      y += rowHeight;
      doc.font('Helvetica-Bold', 10)
        .text('Precio', col1, y)
        .text(`$${precio.toLocaleString('es-PA', { minimumFractionDigits: 2 })}`, col2, y);
      
      y += rowHeight;
      doc.font('Helvetica', 10)
        .text('Fecha de Vigencia', col1, y)
        .text(fechaExp.toLocaleDateString('es-PA'), col2, y);
      
      doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke();

      y += 45;
      doc.font('Helvetica-Bold', 14).text('TOTAL: ', col1, y);
      doc.font('Helvetica-Bold', 14).text(
        `$${precio.toLocaleString('es-PA', { minimumFractionDigits: 2 })}`,
        col2,
        y
      );

      y += 50;
      doc.font('Helvetica-Bold', 11).text('Términos y Condiciones:', 40, y);
      doc.font('Helvetica', 9)
        .text('• Esta propuesta es válida hasta el ' + fechaExp.toLocaleDateString('es-PA'), 40, y + 20)
        .text('• Está sujeta a disponibilidad de inventario', 40, y + 35)
        .text('• Los precios incluyen IVU (7%)', 40, y + 50)
        .text('• Se requiere depósito del 30% para reservar el vehículo', 40, y + 65);

      y += 100;
      doc.moveTo(40, y).lineTo(555, y).stroke();
      doc.font('Helvetica-Bold', 11).text('¿Preguntas?', 40, y + 15);
      doc.font('Helvetica', 10)
        .text('Car Mulle Service - Distribuidor Oficial HISUN', 40, y + 35)
        .text('📞 +507 6XXX-XXXX | 📧 info@hisun.com.pa', 40, y + 50)
        .text('🌐 https://hisun.com.pa', 40, y + 65);

      doc.fontSize(8)
        .text(`Propuesta ID: ${dealId}`, 40, doc.page.height - 40, { align: 'left' })
        .text(`Generado: ${new Date().toLocaleDateString('es-PA')}`, doc.page.width - 180, doc.page.height - 40, { align: 'right' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

app.post('/api/cotizar', async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, modelo, color } = req.body;

    if (!nombre || !apellido || !email || !modelo || !color) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (!PRECIOS[modelo]) {
      return res.status(400).json({ error: 'Modelo inválido' });
    }

    const precio = PRECIOS[modelo];
    const cotizacionId = uuidv4();
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 7);

    console.log('📋 Nueva cotización:', { nombre, apellido, email, modelo, color, precio });

    const contactoData = {
      properties: {
        firstname: nombre,
        lastname: apellido,
        email: email,
        phone: telefono || '',
        modelo_interes: modelo,
        color_seleccionado: color,
        precio_cotizacion: precio.toString(),
        cotizacion_id: cotizacionId,
        fecha_cotizacion: new Date().toISOString(),
        fuente_cotizacion: 'Preventa 2026'
      }
    };

    let contactoId;
    try {
      const contactoResponse = await hubspotClient.crm.contacts.basicApi.create(contactoData);
      contactoId = contactoResponse.id;
      console.log('✅ Contacto creado en HubSpot:', contactoId);
    } catch (error) {
      const existentes = await hubspotClient.crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email
              }
            ]
          }
        ],
        limit: 1
      });

      if (existentes.results.length > 0) {
        contactoId = existentes.results[0].id;
        await hubspotClient.crm.contacts.basicApi.update(contactoId, { properties: contactoData.properties });
        console.log('✏️ Contacto actualizado en HubSpot:', contactoId);
      } else {
        throw error;
      }
    }

    const dealNombre = `${nombre} ${apellido} - ${modelo} (${color})`;

    const dealData = {
      properties: {
        dealname: dealNombre,
        dealstage: 'prospecting',
        amount: precio.toString(),
        closedate: fechaExpiracion.toISOString().split('T')[0],
        pipeline: 'Preventa 2026',
        modelo: modelo,
        color_vehiculo: color,
        cotizacion_id: cotizacionId,
        fecha_expiracion: fechaExpiracion.toISOString()
      }
    };

    const dealResponse = await hubspotClient.crm.deals.basicApi.create(dealData);
    const dealId = dealResponse.id;
    console.log('✅ Deal creado en HubSpot:', dealId);

    try {
      await hubspotClient.crm.deals.associationsApi.create(dealId, 'contact', contactoId, 'deal_contact');
      console.log('✅ Deal asociado a contacto');
    } catch (e) {
      console.log('⚠️ Deal y contacto no se asociaron');
    }

    console.log('📄 Generando PDF...');
    const pdfBuffer = await generarPDFCotizacion(
      nombre,
      apellido,
      email,
      modelo,
      color,
      precio,
      fechaExpiracion,
      dealId
    );
    console.log('✅ PDF generado:', pdfBuffer.length, 'bytes');

    console.log('📧 Enviando email...');
    
    const htmlEmail = `
      <html>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
          <table style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px;">
            <tr>
              <td style="text-align: center; border-bottom: 3px solid #ff6b35; padding-bottom: 20px;">
                <h1 style="color: #333; margin: 0;">Tu Propuesta HISUN está lista</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px 0;">
                <p style="font-size: 16px; color: #333;">
                  Hola <strong>${nombre}</strong>,
                </p>
                <p style="font-size: 14px; color: #666; line-height: 1.6;">
                  Nos complace enviarte tu propuesta personalizada para un vehículo HISUN 2026.
                </p>
              </td>
            </tr>
            <tr>
              <td>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr style="background: #f9f9f9;">
                    <td style="padding: 12px; font-weight: bold; border-bottom: 2px solid #ff6b35;">Modelo</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 2px solid #ff6b35;">${modelo}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; font-weight: bold;">Color</td>
                    <td style="padding: 12px; text-align: right;">${color}</td>
                  </tr>
                  <tr style="background: #f9f9f9;">
                    <td style="padding: 12px; font-weight: bold;">Precio</td>
                    <td style="padding: 12px; text-align: right; color: #ff6b35; font-size: 18px; font-weight: bold;">
                      $${precio.toLocaleString('es-PA', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px; font-weight: bold;">Válido hasta</td>
                    <td style="padding: 12px; text-align: right; color: #ff6b35;">
                      ${fechaExpiracion.toLocaleDateString('es-PA')}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 0; text-align: center;">
                <p style="font-size: 14px; color: #666;">
                  Adjunto encontrarás el PDF con los detalles de tu propuesta.
                </p>
              </td>
            </tr>
            <tr>
              <td style="border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #999; line-height: 1.6;">
                <p>¿Preguntas? Contáctanos:<br>
                📞 +507 6XXX-XXXX<br>
                📧 info@hisun.com.pa<br>
                🌐 https://hisun.com.pa
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: `Tu Propuesta HISUN ${modelo} - ${color}`,
      html: htmlEmail,
      attachments: [
        {
          filename: `Propuesta_HISUN_${cotizacionId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });

    console.log('✅ Email enviado a:', email);

    res.json({
      success: true,
      message: 'Cotización enviada exitosamente',
      cotizacionId,
      dealId,
      contactoId
    });

  } catch (error) {
    console.error('❌ Error en cotización:', error);
    res.status(500).json({ 
      error: 'Error procesando cotización',
      details: error.message 
    });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║   🚙 SERVIDOR COTIZACIONES HISUN - Online                ║
║   Puerto: ${PORT}                                          ║
║   Endpoint: POST /api/cotizar                              ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;