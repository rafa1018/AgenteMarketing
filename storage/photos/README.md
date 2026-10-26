# Fotos reales por empresa

Carpetas para fotos REALES (no generadas por IA) de cada empresa, organizadas por el
formato exacto en el que se van a usar. El workflow las usa como fondo de las
publicaciones en vez de generar una foto con IA (Recraft) cuando existe una disponible
para ese formato — mas autentico y sin costo.

## Estructura

```
storage/photos/<company_id>/post_1080x1080/   -> publicaciones cuadradas (feed)
storage/photos/<company_id>/story_1080x1920/  -> historias / reels (vertical)
```

## Como agregar fotos

1. Exporta o recorta la foto exactamente al tamaño de la subcarpeta (1080x1080 o 1080x1920).
2. Guardala en formato .jpg o .png dentro de la subcarpeta de la empresa correspondiente.
3. El nombre del archivo no importa (el workflow toma cualquier archivo de la carpeta).

## Fotos generadas automaticamente

Las fotos que genera la IA (Recraft) y las imagenes finales ya compuestas (con texto y
logo, listas para publicar) se guardan automaticamente en `storage/generated/<company_id>/`
— no hace falta tocar esa carpeta a mano, es solo un archivo/registro de lo que el sistema
ya genero y envio.
