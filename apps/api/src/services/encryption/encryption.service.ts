import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync
} from 'node:crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly kdfSaltLength = 32;
  private readonly masterSecret: string;

  public constructor(
    private readonly configurationService: ConfigurationService
  ) {
    this.masterSecret = this.configurationService.get('ACCESS_TOKEN_SALT');
  }

  public encrypt(plainText: string): {
    encrypted: string;
    iv: string;
    kdfSalt: string;
    tag: string;
  } {
    const kdfSalt = randomBytes(this.kdfSaltLength);
    // scrypt deriva una clave única por credencial; N=16384, r=8, p=1 (parámetros conservadores)
    const key = scryptSync(this.masterSecret, kdfSalt, 32, {
      N: 16384,
      r: 8,
      p: 1
    });
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      kdfSalt: kdfSalt.toString('hex'),
      tag
    };
  }

  public decrypt(
    encrypted: string,
    iv: string,
    tag: string,
    kdfSalt: string | null
  ): string {
    // Compatibilidad con registros cifrados antes de introducir el KDF por credencial
    const key = kdfSalt
      ? scryptSync(this.masterSecret, Buffer.from(kdfSalt, 'hex'), 32, {
          N: 16384,
          r: 8,
          p: 1
        })
      : createHash('sha256').update(this.masterSecret).digest();

    const decipher = createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
