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
