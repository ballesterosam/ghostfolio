import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly key: Buffer;

  public constructor(
    private readonly configurationService: ConfigurationService
  ) {
    const salt = this.configurationService.get('ACCESS_TOKEN_SALT');
    this.key = createHash('sha256').update(salt).digest();
  }

  public encrypt(plainText: string): {
    encrypted: string;
    iv: string;
    tag: string;
  } {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag
    };
  }

  public decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
