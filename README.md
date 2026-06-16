# SelfTalk 💬

A **private, local self-chat app** — replace your WhatsApp self-chat with offline conversations powered by local AI.

## Features

- 🔒 **100% Private** — All conversations stored locally, no cloud sync
- 🤖 **AI Assistant** — Works with OpenAI, Claude, Anthropic, Google Gemini, DeepSeek, or local models (BYOK)
- 💾 **Import/Export** — Backup conversations as JSON or Markdown, restore anytime
- ⚙️ **Security** — PIN lock, biometric authentication (fingerprint/face), auto-lock on exit
- 📌 **Organization** — Pin messages, archive, trash with restore, search by hashtag or content type
- 🔔 **Reminders** — Set alarms with customizable notifications per message
- 🎨 **Themes** — Light, dark, and automatic (system-based)
- 📱 **Android Native** — Built with Kotlin + Jetpack Compose, optimized for mobile

---

## Getting Started

### Requirements

- Android 8.0+
- Node.js 18 LTS or higher (for development)
- Android Studio (for building APK)

### Installation from Source

```bash
git clone https://github.com/mokenpaven/selftalk.git
cd selftalk/frontend

# Install dependencies
npm install

# Run with Expo
npx expo start

# For Android APK
npx expo prebuild --platform android
# Then open in Android Studio and build
```

---

## Configuration

### AI Providers (BYOK - Bring Your Own Key)

1. Go to **Settings → AI Assistant**
2. Enter your API key from your chosen provider
3. Start chatting in the **AI** tab

| Provider | Get Key |
|----------|---------|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Claude (Anthropic) | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| DeepSeek | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |

---

## Privacy & Security

- ✅ **Offline-first** — Messages stay on your device
- ✅ **No registration** — No account required
- ✅ **Secure storage** — PIN/biometric protection
- ✅ **No automatic cloud backup** — You control when and where to export
- ✅ **API keys stored locally** — Never sent to SelfTalk servers

---

## License

MIT License — See [LICENSE](LICENSE) for details

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

<p align="center">
  <strong>SelfTalk</strong> — Your notes are yours.
</p>
