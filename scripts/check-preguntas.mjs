// Valida todos los bancos de /preguntas. Sale con código 1 si hay errores.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir = new URL('../preguntas/', import.meta.url).pathname;
const ficheros = readdirSync(dir).filter((f) => f.endsWith('.json'));
const ids = new Map();
let errores = 0;
let total = 0;

const fallo = (f, msg) => {
  errores++;
  console.error(`✗ ${f}: ${msg}`);
};

for (const f of ficheros) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch (e) {
    fallo(f, `JSON inválido (${e.message})`);
    continue;
  }
  const lista = Array.isArray(data) ? data : data.preguntas;
  if (!Array.isArray(lista)) {
    fallo(f, 'no tiene un array "preguntas"');
    continue;
  }
  lista.forEach((p, i) => {
    const ref = p.id ?? `#${i}`;
    if (!p.id) fallo(f, `pregunta ${ref} sin id`);
    else if (ids.has(p.id)) fallo(f, `id ${p.id} repetido (también en ${ids.get(p.id)})`);
    else ids.set(p.id, f);
    if (!p.enunciado) fallo(f, `${ref} sin enunciado`);
    if (!Array.isArray(p.opciones) || p.opciones.length < 2) {
      fallo(f, `${ref} necesita al menos 2 opciones`);
      return;
    }
    const correctas = p.opciones.filter((o) => o.correcta === true).length;
    if (!p.anulada && correctas !== 1) fallo(f, `${ref} tiene ${correctas} correctas (debe ser 1)`);
    p.opciones.forEach((o, j) => {
      for (const k of ['texto', 'explicacion']) {
        if (!o[k]) fallo(f, `${ref} opción ${j + 1} sin "${k}"`);
      }
      if (typeof o.correcta !== 'boolean') fallo(f, `${ref} opción ${j + 1}: "correcta" debe ser true/false`);
    });
  });
  total += lista.length;
  console.log(`✓ ${f}: ${lista.length} preguntas`);
}

if (errores) {
  console.error(`\n${errores} errores.`);
  process.exit(1);
}
console.log(`\nTodo correcto: ${total} preguntas en ${ficheros.length} ${ficheros.length === 1 ? "banco" : "bancos"}.`);
