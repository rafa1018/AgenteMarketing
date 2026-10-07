# Gabush Kids — sitio web + panel de administración

Jardín Infantil Gabush Kids (Valledupar) · "Creciendo con las artes".
React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · Lucide + API en PHP (sin base de datos: archivos JSON).
Basado en el proyecto de Club Grandes Genios (`E:\2026\jardinInfantil\clubgrandesgenios`).

## Comandos

```bash
npm install
npm run api       # PHP local en 127.0.0.1:8020 (formulario, feed, panel)
npm run dev       # http://localhost:5190   ·   panel: http://localhost:5190/admin/
npm run build     # type-check + build → dist/
npm run zip       # empaqueta dist/ en gabush-hostinger.zip
npm run images    # regenera WebP, favicons (león), feed inicial e imagen OG desde public/images
npm run admin-password -- <usuario> <contraseña>          # dueño técnico (config.php, todos los permisos)
npm run user -- <usuario> <rectora|docente|auxiliar> "<Nombre>" [contraseña]   # usuario del equipo (local)
```

Puertos distintos a Grandes Genios (5180/8010) para poder correr ambos a la vez.

## Sitio público (secciones)

Intro (letras GABUSH + león) → Hero con slider de fotos reales y objetos animados (anim-icons) → Nosotros →
Así aprenden (dimensiones) → Niveles (Párvulos, Prejardín, Jardín, Transición + Artes, Inglés, Vacaciones) →
**Momentos** (feed estilo Instagram, administrado desde el panel; no se conecta a Instagram) → Cómo inscribir →
Galería → Calendario → Inscripciones abiertas → Preguntas → Contacto + formulario de inscripción.

| Archivo | Qué contiene |
| --- | --- |
| `src/data/site.ts` | WhatsApp, correo, dirección, licencia/DANE, redes |
| `src/data/programs.ts` | Niveles y programas (edades, fotos, qué incluye) |
| `src/data/content.ts` | Nosotros, dimensiones, pasos, galería, testimonios, preguntas |
| `src/i18n/ui.ts` | Textos de botones y formularios (ES/EN) |

## Panel (/admin/) — usuarios, roles y permisos

Menú vertical en computador; barra inferior en el celular. Se instala como app (Chrome → "Instalar app";
iPhone → Safari → Compartir → "Agregar a inicio").

| Rol (punto de partida) | Permisos |
| --- | --- |
| Rectora | Todo |
| Docente | Asistencia |
| Auxiliar | Estudiantes + Calendario (eventos públicos/privados) |
| Personalizado | Lo que marque la rectora |

Permisos: asistencia, estudiantes, pagos, inscripciones, calendario, feed, ajustes, usuarios.
La rectora crea usuarios y ajusta permisos en **Usuarios**. El servidor valida cada permiso en cada petición
(`rp_require_perm` en `public/api/_bootstrap.php`); ocultar botones es solo comodidad.
Notificaciones push por usuario: cada dispositivo recibe solo los avisos de lo que su usuario maneja
(p. ej. inscripciones nuevas → quien tenga el permiso "inscripciones").

**Momentos (feed):** en el celular, botones "Tomar foto" (cámara) y "Galería". La foto se recorta cuadrada
(1080 px + miniatura 480 px) y aparece al instante en la página pública. Se puede editar texto/fecha, ocultar,
reordenar y eliminar.

## Publicar (Hostinger, SSH)

`npm run deploy` (usa `.deploy.local.json`, misma llave que Grandes Genios) → `domains/gabushkids.com/public_html`.
- Nunca toca `domains/gabushkids.com/gabush-data` (datos reales) y nunca sube datos locales de prueba.
- Conserva `api/config.php` del servidor (contraseña del dueño, sal, Telegram); solo lo sube si no existe.
- El WordPress anterior quedó respaldado (archivos + base de datos) en `~/backups/gabushkids/wordpress-202610070305/`.
- Cron (hPanel → Avanzado → Cron Jobs, cada 15 min): `/usr/bin/php /home/u668220027/domains/gabushkids.com/public_html/api/cron.php`
  — hace la copia diaria de los datos y envía los recordatorios.

## Datos

Local: `.api-data/`. Producción: carpeta `gabush-data` al lado de `public_html` (publicar no la borra).
Copia automática diaria (14 días) + descarga manual en Ajustes. Incluye `users.json` y las fotos del feed.

## Formulario de inscripción → Telegram

`public/api/config.php` (ignorado por git; plantilla `config.example.php`): token y chat id de Telegram,
orígenes permitidos, sal, dueño técnico.

## Pendiente de confirmar con el jardín

- Edades de cada nivel (puse las habituales en Colombia: 2-3, 3-4, 4-5, 5-6).
- Precios (pregunta frecuente con placeholder `[AGREGAR INFORMACIÓN DE PRECIOS]`).
- Horario real (se configura en el panel → Calendario → Horario).
- Fotos de "Niveles" (class-*.jpg) son ilustrativas; conviene reemplazarlas por fotos reales.
