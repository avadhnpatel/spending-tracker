import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function encryptionKey(): Buffer {
  const encoded = process.env.PROVISIONING_ENCRYPTION_KEY
  if (!encoded) throw new Error('PROVISIONING_ENCRYPTION_KEY is not configured')
  const key = Buffer.from(encoded, 'base64url')
  if (key.length !== 32) throw new Error('PROVISIONING_ENCRYPTION_KEY must decode to exactly 32 bytes')
  return key
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(value: string): string {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !ciphertext) throw new Error('Encrypted setup value is invalid')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
