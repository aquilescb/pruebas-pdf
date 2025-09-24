import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

// Página de prueba con un formulario
app.get("/", (req, res) => {
   res.send(`
  <!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>PDF Calibri Demo</title>
  <link rel="stylesheet" href="/public/styles.css">
  </head><body>
    <h1>Generar PDF (Calibri)</h1>
    <form onsubmit="enviar(event)">
      <label>Apellido y Nombre <input name="nombre" value="Perez, Ana"></label><br>
      <label>DNI <input name="dni" value="12.345.678"></label><br>
      <label>Mensaje <textarea name="mensaje">Texto de ejemplo justificado en Calibri 11.</textarea></label><br>
      <button>Generar PDF</button>
    </form>
    <p><a href="/health/calibri" target="_blank">Chequear si el servidor tiene Calibri</a></p>
    <script>
      async function enviar(e){
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        const res = await fetch('/pdf', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(data)
        });
        if(!res.ok){ alert('Error generando PDF'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='informe.pdf'; a.click();
        URL.revokeObjectURL(url);
      }
    </script>
  </body></html>`);
});

// Salud: ¿el server tiene Calibri?
app.get("/health/calibri", async (_req, res) => {
   const browser = await puppeteer.launch(); // en algunos hostings Linux: { args: ['--no-sandbox'] }
   const page = await browser.newPage();
   await page.setContent(`<html><body>check</body></html>`);
   const has = await page.evaluate(async () => {
      if (!("fonts" in document)) return false;
      try {
         return document.fonts.check('12pt "Calibri"');
      } catch {
         return false;
      }
   });
   await browser.close();
   res.type("text/plain").send(
      has
         ? "OK: Calibri detectada en el servidor"
         : "NO: Calibri no detectada (se usará Carlito como fallback)"
   );
});

// Generar PDF
app.post("/pdf", async (req, res) => {
   const { nombre = "", dni = "", mensaje = "" } = req.body || {};
   const esc = (s) =>
      String(s).replace(
         /[&<>"']/g,
         (c) =>
            ({
               "&": "&amp;",
               "<": "&lt;",
               ">": "&gt;",
               '"': "&quot;",
               "'": "&#39;",
            }[c])
      );

   // HTML con A4, márgenes 2.5 cm, Título 14pt, cuerpo 11pt justificado.
   // font-family: Calibri primero; si el server no la tiene, usa Carlito hosteada por nosotros.
   const html = `
  <!doctype html>
  <html lang="es"><head><meta charset="utf-8">
  <title>Informe</title>
  <link rel="stylesheet" href="/public/styles.css">
  </head><body>
    <header class="only-first"></header>
    <h1>Informe Final 2024</h1>
    <p><strong>Apellido y Nombre:</strong> ${esc(nombre)}</p>
    <p><strong>DNI:</strong> ${esc(dni)}</p>
    <p>${esc(mensaje)}</p>
    <footer>Firmas y sellos: Coni Josefina y Sandra (Coordinadoras) · Victoria (Presidenta)</footer>
  </body></html>`;

   const browser = await puppeteer.launch(); // en Linux podría requerir { args: ['--no-sandbox'] }
   const page = await browser.newPage();
   await page.setContent(html, { waitUntil: "networkidle0" });

   const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
   });

   await browser.close();
   res.setHeader("Content-Type", "application/pdf");
   res.setHeader("Content-Disposition", 'attachment; filename="informe.pdf"');
   res.send(pdf);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("▶ http://localhost:" + PORT));
