import { CreateMessage, generateId, Message } from 'ai'

/**
 * Programmatically download a `File`.
 */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Ensures that a `Message` has an `id` by generating one if it
 * doesn't exist.
 */
export function ensureMessageId(message: Message | CreateMessage): asserts message is Message {
  if (!('id' in message)) {
    message.id = generateId()
  }
}
