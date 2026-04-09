import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Serviço de criptografia AES-256-GCM para dados sensíveis no banco.
 * Usado para: tokens da Meta API, configs de integração de ecommerce.
 *
 * Formato armazenado: iv:tag:ciphertext (tudo em hex)
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const hexKey = process.env.ENCRYPTION_KEY;
    if (!hexKey || hexKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY deve ser uma string hex de 64 caracteres (32 bytes).');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  decrypt(stored: string): string {
    const [ivHex, tagHex, cipherHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
