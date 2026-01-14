# Estructura Modular del Renderer

## 📁 Organización

```
src/renderer/
├── app-modular.js          # Orquestador principal (150 líneas)
├── config/                 # Configuración centralizada
│   └── constants.js       # Constantes y configuraciones
├── core/                   # Lógica central
│   ├── state.js           # Estado global de la aplicación
│   └── ipc-handlers.js    # Manejadores de eventos IPC
├── ui/                     # Componentes de interfaz
│   ├── console.js         # Logging y mensajes del sistema
│   ├── stats.js           # Visualización de estadísticas
│   ├── ui-controls.js     # Control de bloqueo/desbloqueo UI
│   ├── pagination.js      # Sistema de carrusel (5 items)
│   └── download-manager.js # CRUD de descargas en UI
└── utils/                  # Utilidades
    ├── validators.js      # Validación de URLs y FFmpeg
    └── helpers.js         # Funciones auxiliares
```

## 🎯 Responsabilidades

### **config/**
**constants.js** - Configuración centralizada
- Niveles de rendimiento (5/10/15/20 slots)
- Items por página (carrusel)
- Intervalos de polling y throttling
- Límites de playlist (100 videos)
- Estados de descarga
- Colores de UI
- Thresholds y timeouts

**Ventaja**: Cambiar configuración en un solo lugar

### **app-modular.js** (Orquestador)
- Inicializa la aplicación
- Expone handlers globales (window.*)
- Coordina módulos
- ~150 líneas (vs 650 del monolito)

### **core/**
**state.js** - Estado centralizado
- Map de descargas activas
- Configuración de rendimiento
- Rango visible del carrusel

**ipc-handlers.js** - Comunicación con backend
- Listeners de eventos Electron
- Sincronización de estado
- Notificaciones de progreso

### **ui/**
**console.js** - Sistema de logs
- `updateConsole()` - Añade mensaje con timestamp
- `clearConsole()` - Limpia historial
- `updateSystemStatus()` - Mensajes coloreados

**stats.js** - Métricas en vivo
- Activas/En cola/Slots disponibles
- Polling cada 3 segundos
- Colores dinámicos según carga

**ui-controls.js** - Manejo de UI
- `lockUI()` - Bloquea controles durante descarga
- `unlockUI()` - Restaura estado post-descarga
- Validación de rendimiento

**pagination.js** - Carrusel virtual
- Muestra solo 5 items a la vez
- Navegación prev/next
- Auto-ajuste al limpiar

**download-manager.js** - Gestión de items
- Crear/Actualizar/Eliminar descargas
- Throttling de updates (500ms)
- Animaciones de entrada/salida
- Estado terminal (COMPLETED/ERROR/STOPPED)

### **utils/**
**validators.js**
- Validación de URLs de YouTube
- Detección de playlists
- Verificación de FFmpeg

**helpers.js**
- Truncado de URLs largas
- Formateo de datos

## 🔧 Mantenimiento

### Agregar nueva funcionalidad
1. Identifica el módulo responsable
2. Exporta la función desde el módulo
3. Importa en app-modular.js si necesita exposición global

### Debugging
- Cada módulo es independiente
- Estado centralizado en `core/state.js`
- Console logs en `ui/console.js`

### Testing
```javascript
// Ejemplo: testear validador
const { validateYouTubeUrl } = require('./utils/validators');
const result = validateYouTubeUrl('https://youtube.com/watch?v=test');
console.assert(result.isValid === true);
```

## 📊 Métricas

| Archivo Original | Líneas | Archivos Modulares | Líneas |
|-----------------|--------|-------------------|--------|
| app.js          | 650    | app-modular.js    | 150    |
|                 |        | state.js          | 15     |
|                 |        | ipc-handlers.js   | 105    |
|                 |        | download-manager.js| 240   |
|                 |        | pagination.js     | 85     |
|                 |        | ui-controls.js    | 40     |
|                 |        | console.js        | 50     |
|                 |        | stats.js          | 45     |
|                 |        | validators.js     | 30     |
|                 |        | helpers.js        | 10     |
| **Total**       | **650**| **Total**         | **770**|

*+120 líneas por modularidad, pero -80% complejidad por archivo*

## 🚀 Ventajas

✅ **Mantenibilidad**: Cada módulo tiene una responsabilidad clara  
✅ **Testeable**: Funciones puras exportables  
✅ **Escalable**: Fácil agregar nuevas features  
✅ **Legible**: Archivos cortos (~50 líneas promedio)  
✅ **Reutilizable**: Módulos independientes  

## ⚠️ Notas

- `app.js` original se mantiene como backup
- `index.html` apunta a `app-modular.js`
- Estado compartido via `require('./core/state')`
- No usar ES6 modules (Electron usa CommonJS)
