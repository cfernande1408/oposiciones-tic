# Oposiciones TIC

Web de tests estilo Daypo para preparar Técnico/a Medio TIC (Ayto. de Madrid) y GSI A2.

https://cfernande1408.github.io/oposiciones-tic/

## Desarrollo

```bash
npm ci
npm start        # http://localhost:3000/oposiciones-tic/
npm run build    # comprueba que compila antes de hacer push
npm run check:preguntas
```

## Añadir preguntas

Deja un `.json` en `preguntas/` y aparece solo en la web. Formato:

```json
{
  "meta": {"id": "mi-banco", "titulo": "Nombre visible"},
  "preguntas": [
    {
      "id": "mi-banco-001",
      "tema": 22,
      "verificada": false,
      "confianza": "alta",
      "anulada": false,
      "enunciado": "...",
      "opciones": [
        {"texto": "...", "correcta": true, "explicacion": "...", "fuente": "Ley 39/2015 art. 63.1"},
        {"texto": "...", "correcta": false, "explicacion": "...", "fuente": "..."},
        {"texto": "...", "correcta": false, "explicacion": "...", "fuente": "..."}
      ],
      "nota": "opcional"
    }
  ]
}
```

Los `id` deben ser únicos entre todos los bancos. `npm run check:preguntas` valida el formato.

## Apuntes

Ficheros Markdown en `docs/`. Se publican en `/apuntes`.

## App en el móvil (PWA)

Abre la web en el móvil y elige «Añadir a pantalla de inicio» (Chrome: menú ⋮ → Instalar app; Safari: Compartir → Añadir a pantalla de inicio). Funciona sin conexión.

Para probar el modo sin conexión en local no sirve `npm run serve` (redirige `sw.js` y el navegador rechaza el service worker). Usa un servidor estático:

```bash
npm run build
mkdir -p /tmp/www && ln -sfn "$PWD/build" /tmp/www/oposiciones-tic
python3 -m http.server 3000 -d /tmp/www
# http://localhost:3000/oposiciones-tic/?offlineMode=true
```
