# Instagram DM Automation

Scripts de automatización de DMs para Instagram web. Pensados para RRPP de discotecas que necesitan enviar el mismo mensaje promocional a muchos contactos.

## Scripts

| Archivo | Descripción |
|---|---|
| `scripts/ig-dm-prueba.js` | Modo prueba (dry-run). Escribe pero NO envía. Máximo 50. |
| `scripts/ig-dm-oficial.js` | Modo real. Envía mensajes de verdad. Máximo 1500. |
| `scripts/ig-dm-personalized.js` | Mensaje personalizado con `{nombre}` del contacto. |

## Cómo usar

1. Ve a `https://www.instagram.com/direct/`
2. Abre la consola del navegador (F12 → Console)
3. Si es la primera vez, escribe `allow pasting` cuando te lo pida
4. Pega el contenido del script que quieras usar
5. Pulsa Enter
6. Ejecuta `igDmSender()` para cargar y filtrar conversaciones
7. Ejecuta `igDmSender.confirm()` para empezar a enviar
8. Para parar: `stopIGDM()`

## Configuración

Edita `IG_DM_CONFIG` al principio del script antes de pegarlo:

```javascript
const IG_DM_CONFIG = {
  mensaje: "tu mensaje aquí",
  delayMin: 4000,        // delay mínimo entre mensajes (ms)
  delayMax: 6000,        // delay máximo entre mensajes (ms)
  maxMensajes: 1500,     // límite de seguridad
  iniciarDesde: 0,       // reanudar desde posición N
  semanasAtras: 3,       // filtrar conversaciones de últimas N semanas
  saltarGrupos: true,    // no enviar a chats grupales
  dryRun: false,         // true = no envía (modo prueba)
  maxScrolls: 100,       // scrolls para cargar conversaciones
};
```

## Script personalizado

Usa `{nombre}` como placeholder. El script extrae el primer nombre de cada contacto:

- `"Carlos García"` → `"Carlos"`
- `"carlos_garcia"` → `"Carlos"`
- `"María López"` → `"María"`

Ejemplo: `¡Hey {nombre}! 👋 Este viernes...` → `¡Hey Carlos! 👋 Este viernes...`

## Safety

- Delay aleatorio de 4-6s entre mensajes
- Confirmación antes de empezar (`igDmSender()` → `igDmSender.confirm()`)
- `stopIGDM()` para parar cuando quieras
- Detección de CAPTCHA/challenge → pausa y avisa
- Salta chats grupales automáticamente
- Filtra notas de Instagram (no las confunde con conversaciones)
- Retry automático si falla un envío
- Resumen final con enviados/fallidos/errores

## Tests

```bash
node tests/test-ig-dm-logic.js      # Tests de lógica (timestamps, nombres, filtrado)
node tests/test-integration.js      # Tests de integración con jsdom
```
