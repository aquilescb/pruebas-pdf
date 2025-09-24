// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

/* ---------- Página de prueba ---------- */
app.get("/", (req, res) => {
   res.send(`
  <!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>PDF Demo</title>
  <link rel="stylesheet" href="/public/styles.css">
  </head><body>
    <h1>Generar PDF</h1>
    <form id="f" onsubmit="enviar(event)">
      <label>Apellido y Nombre <input name="nombre" value="Pérez, Ana Sofía"></label><br>
      <label>DNI <input name="dni" value="12.345.678"></label><br>
      <label>Email <input name="email" value="ana.perez@example.com"></label><br>
      <label>Teléfono <input name="telefono" value="+54 387 123 4567"></label><br>
      <label>Dirección <input name="direccion" value="Av. Belgrano 123, Salta Capital"></label><br>
      <label>Mensaje 
        <textarea name="mensaje">Este es un párrafo de prueba bastante más largo, escrito para verificar que la justificación funcione correctamente en varias líneas y que el PDF generado mantenga la estética deseada. 
Además, se observa cómo se comporta la fuente seleccionada cuando el texto ocupa más de un renglón, con diferentes saltos y estructura. 
La idea es simular un informe real, con varios apartados y contenido suficiente para validar el diseño.</textarea>
      </label><br>

      <div class="btns">
        <button data-font="calibri">PDF con Calibri</button>
        <button data-font="carlito">PDF con Carlito</button>
      </div>
    </form>

    <p><a href="/health/calibri" target="_blank">Chequear si el servidor tiene Calibri</a></p>

    <script>
      const form = document.getElementById('f');
      document.querySelectorAll('button[data-font]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          enviar(e, btn.dataset.font);
        });
      });

      async function enviar(e, font){
        const fd = new FormData(form);
        const data = Object.fromEntries(fd.entries());
        const res = await fetch('/pdf?font=' + (font || 'calibri'), {
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

/* ---------- Plantilla HTML usada por Puppeteer ---------- */
app.get("/_template", (req, res) => {
   const {
      nombre = "",
      dni = "",
      email = "",
      telefono = "",
      direccion = "",
      mensaje = "",
      font = "calibri",
   } = req.query;
   const esc = (s) =>
      String(s).replace(
         /[&<>\"']/g,
         (c) =>
            ({
               "&": "&amp;",
               "<": "&lt;",
               ">": "&gt;",
               '"': "&quot;",
               "'": "&#39;",
            }[c])
      );

   const fontFamily =
      font === "carlito"
         ? `"Carlito", sans-serif`
         : `Calibri, "Carlito", sans-serif`;

   res.send(`<!doctype html>
  <html lang="es"><head><meta charset="utf-8">
    <title>Informe</title>
    <link rel="stylesheet" href="/public/styles.css">
    <style>
      body{ font-family:${fontFamily}; }
      h1 { text-align:center; font-size:20pt; margin-bottom:20pt; }
      p.datos strong { display:inline-block; width:120px; }
    </style>
  </head><body>
    <header class="only-first"></header>
    <h1>Informe Final 2024</h1>
    <p class="datos"><strong>Apellido y Nombre:</strong> ${esc(nombre)}</p>
    <p class="datos"><strong>DNI:</strong> ${esc(dni)}</p>
    <p class="datos"><strong>Email:</strong> ${esc(email)}</p>
    <p class="datos"><strong>Teléfono:</strong> ${esc(telefono)}</p>
    <p class="datos"><strong>Dirección:</strong> ${esc(direccion)}</p>

    <h2>Mensaje</h2>
    <p>${esc(mensaje)}</p>

    <footer>Firmas y sellos: Coni Josefina y Sandra (Coordinadoras) · Victoria (Presidenta)</footer>
  </body></html>`);
});

/* ---------- Salud: ¿el server tiene Calibri? ---------- */
app.get("/health/calibri", async (_req, res) => {
   const browser = await puppeteer.launch(/* { args: ['--no-sandbox'] } */);
   const page = await browser.newPage();
   await page.setContent(`<html><body>check</body></html>`);
   const has = await page.evaluate(() => {
      try {
         return document.fonts?.check('12pt "Calibri"') || false;
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

/* ---------- Generar PDF ---------- */
app.post("/pdf", async (req, res) => {
   const {
      nombre = "",
      dni = "",
      email = "",
      telefono = "",
      direccion = "",
      mensaje = "",
   } = req.body || {};
   const font =
      new URLSearchParams(req.query).get("font") === "carlito"
         ? "carlito"
         : "calibri";

   const url = new URL("/_template", BASE_URL);
   url.searchParams.set("nombre", nombre);
   url.searchParams.set("dni", dni);
   url.searchParams.set("email", email);
   url.searchParams.set("telefono", telefono);
   url.searchParams.set("direccion", direccion);
   url.searchParams.set("mensaje", mensaje);
   url.searchParams.set("font", font);

   const browser = await puppeteer.launch(/* { args: ['--no-sandbox'] } */);
   const page = await browser.newPage();
   await page.goto(url.href, { waitUntil: "networkidle0" });

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

app.listen(PORT, () => console.log("▶ " + BASE_URL));
