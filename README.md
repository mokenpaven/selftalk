```markdown
# SelfTalk 💬

Una **aplicación de chat privado y local** — reemplaza tu chat conmigo mismo de WhatsApp con conversaciones offline potenciadas por IA local.

## Características

- 🔒 **100% Privado** — Todas las conversaciones se guardan localmente, sin sincronización en la nube
- 🤖 **Asistente de IA** — Compatible con OpenAI, Claude, Anthropic, Google Gemini, DeepSeek o modelos locales (BYOK)
- 💾 **Importar/Exportar** — Respalda conversaciones en JSON o Markdown, restaura en cualquier momento
- ⚙️ **Seguridad** — Bloqueo con PIN, autenticación biométrica (huella/rostro), bloqueo automático al salir
- 📌 **Organización** — Fijar mensajes, archivar, papelera con restauración, búsqueda por hashtag o tipo de contenido
- 🔔 **Recordatorios** — Alarmas con notificaciones personalizables por mensaje
- 🎨 **Temas** — Claro, oscuro y automático (según el sistema)
- 📱 **Android Nativo** — Construido con Kotlin + Jetpack Compose, optimizado para móvil

---

## Primeros pasos

### Requisitos

- Android 8.0+
- Node.js 18 LTS o superior (para desarrollo)
- Android Studio (para compilar APK)

### Instalación desde el código fuente

```bash
git clone https://github.com/mokenpaven/selftalk.git
cd selftalk/frontend

# Instalar dependencias
npm install

# Ejecutar con Expo
npx expo start

# Para compilar APK en Android
npx expo prebuild --platform android
# Luego abre en Android Studio y compila
```

---

## Configuración

### Proveedores de IA (BYOK - Trae tu propia clave)

1. Ve a **Configuración → Asistente de IA**
2. Ingresa tu clave API del proveedor elegido
3. Comienza a chatear en la pestaña **IA**

| Proveedor | Obtener clave |
|-----------|---------------|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Claude (Anthropic) | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| DeepSeek | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |

---

## Privacidad y Seguridad

- ✅ **Offline-first** — Los mensajes permanecen en tu dispositivo
- ✅ **Sin registro** — No se requiere cuenta
- ✅ **Almacenamiento seguro** — Protección con PIN/biometría
- ✅ **Sin respaldo automático en la nube** — Controlas cuándo y dónde exportar
- ✅ **Claves de API almacenadas localmente** — Nunca se envían a servidores de SelfTalk

---

## Licencia

Licencia MIT — Ver [LICENSE](LICENSE) para más detalles

---

## Contribuir

¡Las contribuciones son bienvenidas!

1. Haz un fork del repositorio
2. Crea una rama: `git checkout -b feature/tu-mejora`
3. Commit: `git commit -m "feat: descripción"`
4. Push: `git push origin feature/tu-mejora`
5. Abre un Pull Request

---

<p align="center">
  <strong>SelfTalk</strong> — Tus notas son tuyas.
</p>
```
