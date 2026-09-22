-- Fase 4 (extensión de Company Brain) — colores de marca reales, extraídos por análisis de
-- píxeles de los logos reales descargados de cada sitio web (no adivinados por texto genérico).
-- Logos guardados en storage/brand/{company_id}/. Ver conversación 2026-09-21 para el método
-- de extracción (Python + Pillow, conteo de color dominante excluyendo blanco/transparente).

BEGIN;

UPDATE company_brand
SET
  logo_path = 'storage/brand/grandesgenios/logo_original.png',
  colors_primary = '#903080',   -- morado: color mas dominante del logo (13.8%), usado en "CLUB INFANTIL"
  colors_secondary = '#F0B038', -- dorado/amarillo, segundo tono mas presente
  visual_style = 'Arcoiris multicolor y ludico. Paleta completa extraida del logo real: ' ||
    '#903080 (morado, acento principal/CTA), #F0B038 y #F0A820 (dorado), #F07020 y #D85820 (naranja), ' ||
    '#F04848 (rojo coral), #E81078 y #D03058 (magenta/rosa), #28A080 y #50B060 (verde), ' ||
    '#38A8B0 y #20A0C8 (azul/turquesa), #5860A0 (indigo). ' ||
    'Usar 3-4 colores del arcoiris por pieza, nunca fondo solido de un solo color; el morado es el ' ||
    'color mas reconocible para textos, CTA y acentos.'
WHERE company_id = 'grandesgenios';

UPDATE company_brand
SET
  logo_path = 'storage/brand/pcscleanup/logo_light.png',
  colors_primary = '#F87800',   -- naranja: color del texto/marca en ambos logos
  colors_secondary = '#7BA8C8', -- azul medio representativo del motivo de splash de agua
  visual_style = 'Icono de splash/salpicadura de agua en tonos azules (rango real #7098C0 a #B8D0E0) ' ||
    'sobre fondo blanco, con el nombre de la empresa en naranja solido #F87800. Estilo profesional, ' ||
    'limpio, con motivo de agua/limpieza. Existe una variante del logo con icono casi blanco ' ||
    '(#F8F8F8) pensada para fondos oscuros (logo_original.png), y esta variante con el splash azul ' ||
    'visible (logo_light.png) para fondos claros/coloridos.'
WHERE company_id = 'pcscleanup';

COMMIT;
