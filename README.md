# IG DM Automator — Chrome Extension v2.0

Extensión de Chrome (Manifest V3) para automatizar el envío de mensajes directos en Instagram. Configura el mensaje, delays, filtros y controla el progreso desde un popup UI.

**No requiere pegar scripts en consola.** La extensión se inyecta automáticamente en `instagram.com/direct/*`.

## Características

- **Popup UI** — configura mensaje, delays, filtros, modo dry-run, personalización con `{nombre}`
- **Auto-inyección** — el script se carga automáticamente al abrir Instagram Direct
- **Progreso en tiempo real** — enviados, fallidos, progreso %, destinatario actual
- **Recovery** — si la página se recarga, la extensión reanuda automáticamente desde donde iba
- **Personalización** — placeholder `{nombre}` extrae el primer nombre del contacto
- **3 modos:** dry-run (no envía), real, personalizado
- **Seguridad:** delay aleatorio, detección de CAPTCHA, límite de mensajes, filtro de grupos

## Instalación

1. Clona este repo o descarga los archivos
2. Ve a `chrome://extensions/`
3. Activa "Modo desarrollador" (arriba a la derecha)
4. Haz clic en "Cargar descomprimida"
5. Selecciona la carpeta `ig-dm-extension/`
6. La extensión aparecerá en la toolbar

## Uso

1. Abre `https://www.instagram.com/direct/`
2. Haz clic en el icono de la extensión en la toolbar 🔥
3. Configura el mensaje, delays, filtros en el popup
4. Haz clic en **▶ Iniciar**
5. El progreso se actualiza en tiempo real en el popup
6. Para parar: **⏹ Detener**

### Placeholder `{nombre}`

Activa "Personalizado" en el popup. La extensión extrae el primer nombre de cada contacto:

- `"Carlos García"` → `"Carlos"`
- `"carlos_garcia"` → `"Carlos"`
- `"María López"` → `"María"`

### Dry Run

Activa "🧪 Dry run" para probar sin enviar. Los mensajes se escriben pero no se envían.

## Arquitectura

```
ig-dm-extension/
├── manifest.json              # MV3: permisos, content_scripts, action popup
├── background/
│   └── service-worker.js      # Inicialización en install
├── content/
│   └── content.js             # Motor DM completo (~945 líneas)
├── popup/
│   ├── popup.html             # UI del popup
│   ├── popup.css              # Dark theme, gradientes, animaciones
│   └── popup.js               # Lógica: formulario, Start/Stop, polling
├── core/
│   ├── defaults.js            # Configuración por defecto
│   └── storage.js             # Wrappers de chrome.storage.local
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── tests/
    └── test-schema.js         # Tests de esquema e inventario (73/73)
```

### Flujo de datos

```
Popup UI ←→ chrome.storage.local (config + progress)
Popup UI → Content Script (START/STOP via chrome.tabs.sendMessage)
Content Script → chrome.storage.local (progress updates)
Content Script → Popup (runtime.sendMessage para notificaciones)
```

## Configuración

| Parámetro | Default | Descripción |
|---|---|---|
| `message` | (mensaje promocional) | Texto a enviar. Soporta `{nombre}` |
| `personalized` | `false` | Activar placeholder `{nombre}` |
| `delayMin` | `4000` | Delay mínimo entre mensajes (ms) |
| `delayMax` | `6000` | Delay máximo entre mensajes (ms) |
| `maxMessages` | `1500` | Límite de seguridad |
| `weeksBack` | `3` | Solo conversaciones de últimas N semanas |
| `skipGroups` | `true` | No enviar a chats grupales |
| `dryRun` | `false` | Escribir pero no enviar |
| `maxScrolls` | `100` | Máximo de scrolls para cargar conversaciones |

## Tests

```bash
# Tests de esquema y estructura
node ig-dm-extension/tests/test-schema.js

# Tests de lógica (timestamps, nombres, filtrado)
node tests/test-ig-dm-logic.js

# Tests de auto-recovery
node tests/test-auto-recovery.js
```

## Changelog

### v2.0
- Popup UI con dark theme y gradientes
- Auto-inyección del script (sin pegar en consola)
- Progreso en tiempo real
- Configuración persistente en chrome.storage
- Recovery automático tras recarga
- Soporte para `{nombre}` integrado
- Service worker para inicialización
- Sin dependencias externas

### v1.1
- Fix: `eval()` bloqueado por CSP en MV3 → inyección vía `<script>` tag
- Recovery añadido al script personalizado
- DOM marker anti-doble-inyección

### v1.0
- Extensión básica de auto-recovery
- 3 scripts independientes (prueba, oficial, personalizado)
