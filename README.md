<<<<<<< HEAD
# SelfTalk

**Tu espacio personal para conversar contigo mismo.** SelfTalk es una aplicación móvil *offline-first* que te permite enviarte notas, ideas, imágenes, audios, archivos y enlaces. Todo queda guardado en tu dispositivo, sin depender de un servidor propio.

<p align="center">
  <img src="docs/screenshots/chat.png" alt="Pantalla principal del chat" width="280" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/settings.png" alt="Pantalla de configuración" width="280" />
</p>

> **Screenshots:** agregá capturas en [`docs/screenshots/`](docs/screenshots/) con los nombres sugeridos (`chat.png`, `settings.png`, `lock.png`, `ai.png`) y actualizá las rutas de arriba si usás otros nombres.

---

## Características

- **Chat personal offline** — mensajes de texto, enlaces, imágenes, notas de voz y archivos adjuntos
- **Almacenamiento local** — SQLite en móvil, AsyncStorage en web; tus datos no salen del dispositivo
- **Seguridad** — bloqueo con PIN, biometría (huella/rostro) y bloqueo automático al salir de la app
- **Organización** — fijar mensajes, archivar, papelera con restauración, búsqueda y filtros por tipo/hashtag
- **Recordatorios** — alarmas con sonidos suaves configurables por mensaje
- **Backup e importación** — exportar/importar conversaciones en JSON con filtros por tipo (texto, imágenes, voz, archivos)
- **Exportación Markdown** — copia legible para humanos (sin re-importación)
- **Asistente de IA (opcional)** — BYOK (*Bring Your Own Key*): OpenAI, Anthropic, Gemini y DeepSeek
- **Temas** — claro, oscuro y automático según el sistema
- **Guardar imágenes en galería** — desde el menú de acciones al mantener presionada una imagen

---

## Requisitos

| Herramienta | Versión recomendada |
|-------------|---------------------|
| [Node.js](https://nodejs.org/) | 18 LTS o superior |
| [npm](https://www.npmjs.com/) | 9+ (incluido con Node) |
| [Expo CLI](https://docs.expo.dev/) | vía `npx expo` |
| [Android Studio](https://developer.android.com/studio) | Para compilar APK (opcional en dev) |
| JDK | 17 (requerido por Android Gradle Plugin) |

**Plataformas soportadas:** Android (principal), Web (limitado), iOS (configurado en `app.json`, requiere Mac para build nativo).

---

## Instalación desde el código fuente

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/selftalk.git
cd selftalk
```

### 2. Instalar dependencias

```bash
cd frontend
npm install
```

### 3. Desarrollo con Expo

```bash
npx expo start
```

Opciones en el menú de Expo:

- **`a`** — abrir en emulador Android
- **`w`** — abrir en navegador web
- Escanear QR con Expo Go (funcionalidad limitada en dispositivo físico)

### 4. Compilar APK para Android (Android Studio)

El proyecto incluye la carpeta nativa `frontend/android/` lista para abrir en Android Studio.

```bash
cd frontend

# Si modificaste plugins nativos en app.json, regenerá el proyecto:
npx expo prebuild --platform android

# Abrí Android Studio → Open → frontend/android/
# Build → Generate Signed Bundle / APK → APK → Release
```

**Nota:** la primera vez, Android Studio descargará el SDK y Gradle. Configurá `local.properties` automáticamente con la ruta de tu SDK (no se commitea al repo).

### 5. Lint

```bash
cd frontend
npm run lint
```

---

## Instrucciones de uso

### Chat principal

1. Escribí un mensaje en el campo inferior o usá el botón **+** para adjuntar cámara, galería o archivo.
2. Mantené presionado un mensaje para abrir **Acciones**: copiar, fijar, archivar, papelera, alarmas o eliminar.
3. En **imágenes**, el menú incluye **Guardar en galería** (solo si lo elegís explícitamente).
4. Deslizá un mensaje para moverlo a papelera o archivo rápidamente.

### Configuración

Accedé desde el ícono de engranaje en el header:

| Sección | Qué podés hacer |
|---------|-----------------|
| **General** | Nombre del chat, tema, correo para backups |
| **Seguridad** | PIN, biometría, bloqueo de app y auto-bloqueo |
| **Asistente de IA** | Configurar API keys y proveedor activo |
| **Backup** | Exportar/importar JSON, exportar Markdown |
| **Zona peligrosa** | Vaciar conversación |

### Backup e importación

1. **Exportar backup** → elegí tipos de mensaje (texto, enlaces, imágenes, voz, archivos) → compartí el JSON (Drive, Dropbox, almacenamiento local, etc.).
2. **Importar conversación** → seleccioná un `.json` de SelfTalk → elegí tipos → **Combinar** (agrega sin duplicar IDs) o **Reemplazar** (borra todo e importa).

### Papelera, archivo y búsqueda

- Menú de navegación (header) → Papelera, Archivo, Buscar.
- Los mensajes en papelera se pueden restaurar o eliminar definitivamente.

---

## Configuración de proveedores de IA

SelfTalk usa el modelo **BYOK**: vos aportás tu propia API key; las claves se guardan en **Expo SecureStore** en el dispositivo.

### Proveedores soportados

| Proveedor | Dónde obtener la key |
|-----------|----------------------|
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Google Gemini** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| **DeepSeek** | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |

### Pasos

1. Ir a **Configuración → Asistente de IA**.
2. Tocar el proveedor deseado e ingresar la API key.
3. Elegir el modelo activo.
4. Abrir la pestaña **IA** desde el menú de navegación del chat.

> Las llamadas a la API se hacen **directamente desde el dispositivo** al proveedor elegido. No hay backend propio de SelfTalk involucrado.

---

## Privacidad y seguridad

- **Datos locales:** mensajes, imágenes (base64 en DB), audios y archivos permanecen en el dispositivo.
- **Sin cuenta obligatoria:** no se requiere registro ni servidor SelfTalk.
- **Bloqueo de app:** el contenido no se monta en pantalla mientras la app está bloqueada (PIN/biometría).
- **Claves de IA:** almacenadas en SecureStore; nunca se incluyen en backups JSON de mensajes.
- **Backups:** exportás vos el archivo; SelfTalk no sube datos a la nube automáticamente.
- **Permisos Android:** cámara, micrófono, almacenamiento y biometría se solicitan solo cuando usás esas funciones.

Recomendación: mantené tu PIN y backups en un lugar seguro. Los backups JSON pueden contener imágenes y audios embebidos.

---

## Estructura del proyecto

```
.
├── frontend/                 # App Expo / React Native
│   ├── app/                  # Rutas (expo-router): chat, settings, ai, trash...
│   ├── src/
│   │   ├── components/       # UI reutilizable
│   │   ├── database/         # Capa SQLite / AsyncStorage
│   │   ├── store/            # Estado global (Zustand)
│   │   ├── utils/            # Export/import, alarmas, IA...
│   │   └── theme/
│   ├── assets/               # Iconos, splash, sonidos
│   └── android/              # Proyecto nativo Android (Gradle)
├── docs/
│   ├── screenshots/          # Capturas para el README
│   └── auditoria-crash-release-android.md
├── LICENSE
└── README.md
```

---

## Contribuir

¡Las contribuciones son bienvenidas!

1. Hacé un **fork** del repositorio.
2. Creá una rama: `git checkout -b feature/mi-mejora`
3. Commit con mensajes claros: `git commit -m "feat: descripción breve"`
4. Push: `git push origin feature/mi-mejora`
5. Abrí un **Pull Request** describiendo el cambio y cómo probarlo.

### Guías rápidas

- Seguí el estilo existente (TypeScript, componentes funcionales, Zustand para estado).
- Probá en Android antes de enviar PRs que toquen UI o nativo.
- No commitees `node_modules/`, `.env`, APKs ni `local.properties`.
- Ejecutá `npm run lint` en `frontend/` antes del PR.

Para reportar bugs, usá **Issues** con: dispositivo, versión de Android, pasos para reproducir y captura si es posible.

---

## Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

## Stack técnico

- [Expo SDK 54](https://expo.dev/) + [React Native 0.81](https://reactnative.dev/)
- [Expo Router 6](https://docs.expo.dev/router/introduction/) — navegación basada en archivos
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — base de datos local
- [Zustand](https://github.com/pmndrs/zustand) — estado global
- [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) + [Reanimated](https://docs.swmansion.com/react-native-reanimated/) — gestos y animaciones

---

<p align="center">
  <strong>SelfTalk</strong> — Tus notas son tuyas.
</p>
=======
# Selftalk 💬

A **private, local self-chat app** - replace your WhatsApp self-chat with offline conversations.

## Features

- 🔒 **100% Private** - All conversations stored locally, no cloud sync
- 🤖 **Local AI Support** - Works with OpenAI, Claude, Google Gemini, DeepSeek, or local models
- 💾 **Import/Export** - Backup conversations as JSON or Markdown
- ⚙️ **Customizable** - Security options: PIN, biometric, auto-lock
- 🎨 **Dark Theme** - Modern Material Design interface
- 📱 **Android Native** - Built with Kotlin + Jetpack Compose

## Screenshots


## Getting Started

### Requirements
- Android 8.0+
- Kotlin 1.9+
- Gradle 8.0+

### Installation

#### From Play Store (Coming soon)

#### From Source
```bash
git clone https://github.com/TU_USUARIO/SelfTalk.git
cd SelfTalk/frontend/android
./gradlew assembleRelease
```

APK estará en `app/release/app-release.apk`

## Usage

1. Open SelfTalk
2. Configure your AI provider (Settings → AI Assistant)
3. Start chatting with yourself
4. Export conversations anytime

## Configuration

### Supported AI Providers
- OpenAI (GPT-4, GPT-3.5)
- Claude (Anthropic)
- Google Gemini
- DeepSeek
- Local models (Ollama, LM Studio)

### Privacy & Security
- No internet connection required for local conversations
- PIN lock for app protection
- Biometric authentication
- Auto-lock on exit

## License

MIT License - See LICENSE file

## Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit PRs

## Author

[@mokenpaven](https://github.com/mokenpaven)

---

**Made with ❤️ for privacy-conscious people**
>>>>>>> 47a6af2fafe7f09657259b382e8855751dc928a0
