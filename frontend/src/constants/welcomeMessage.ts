import { database } from '../database/db';
import { storage } from '../utils/storage';

const WELCOME_SEEDED_KEY = '@selftalk_welcome_seeded';

export const WELCOME_MESSAGE_ID = 'msg_selftalk_welcome';

export const WELCOME_MESSAGE_CONTENT = `Bienvenido a SelfTalk

SelfTalk es un espacio personal para guardar pensamientos, ideas, recordatorios, enlaces, imágenes y conversaciones con vos mismo.

Muchas personas utilizan un chat personal en aplicaciones de mensajería para almacenar información importante. SelfTalk ofrece esa misma simplicidad, pero con una diferencia fundamental: tu información te pertenece.

Todo se almacena localmente en tu dispositivo y puede exportarse fácilmente cuando lo necesites. Tus notas no quedan encerradas dentro de una plataforma, sujetas a cambios de políticas, servicios externos o decisiones de terceros. Lo que escribís es tuyo, y debe seguir siéndolo.

Además de texto, podés adjuntar imágenes desde tu galería o tomar fotografías directamente desde la aplicación. Estas imágenes funcionan como notas visuales integradas en la conversación, permitiéndote registrar información de forma rápida y contextual.

Manteniendo presionado cualquier mensaje, podés:

• Asignarle una alarma o recordatorio.
• Fijarlo para encontrarlo rápidamente.
• Archivarlo para ocultarlo del chat principal.
• Enviarlo a la papelera.
• Eliminarlo de forma permanente.

También podés deslizar un mensaje hacia la izquierda para enviarlo rápidamente a la papelera, o hacia la derecha para archivarlo.

Si deseás incorporar inteligencia artificial, podés configurar tu propia clave API en Ajustes y conversar con el modelo de tu preferencia acerca de tus notas, ideas y registros. Vos decidís qué servicio utilizar y cuándo utilizarlo.

SelfTalk fue creado para quienes desean construir una memoria personal duradera: un lugar donde capturar información, organizar pensamientos y conservar aquello que consideran valioso, sin depender de una empresa para acceder a ello.

Espero sinceramente que esta aplicación te resulte útil y que encuentres en ella un espacio cómodo para pensar, recordar y crear.

— Franco Sigot, creador de SelfTalk

Contacto: fsigot@proton.me`;

export const WELCOME_METADATA = JSON.stringify({ isWelcome: true });

export function isWelcomeMessage(message: { id?: string; metadata?: string }): boolean {
  if (message.id === WELCOME_MESSAGE_ID) return true;
  if (!message.metadata) return false;
  try {
    const meta = JSON.parse(message.metadata);
    return meta?.isWelcome === true;
  } catch {
    return false;
  }
}

export async function ensureWelcomeMessage(): Promise<void> {
  await database.init();
  const seeded = await storage.getItem<boolean>(WELCOME_SEEDED_KEY, false);
  if (seeded === true) return;

  const allMessages = await database.getAllMessages();
  const earliest =
    allMessages.length > 0
      ? Math.min(...allMessages.map((m) => m.timestamp)) - 1
      : Date.now();

  await database.insertSystemMessage({
    id: WELCOME_MESSAGE_ID,
    type: 'text',
    content: WELCOME_MESSAGE_CONTENT,
    metadata: WELCOME_METADATA,
    timestamp: earliest,
  });
  await storage.setItem(WELCOME_SEEDED_KEY, true);
}