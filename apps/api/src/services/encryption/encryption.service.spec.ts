import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';

import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let mockConfigurationService: jest.Mocked<ConfigurationService>;

  beforeAll(() => {
    mockConfigurationService = {
      get: jest.fn().mockReturnValue('my-secret-access-token-salt-value-123')
    } as any;

    encryptionService = new EncryptionService(mockConfigurationService);
  });

  it('should encrypt and decrypt a string correctly', () => {
    const originalText = 'my-super-secret-indexa-token-12345';

    const encryptedData = encryptionService.encrypt(originalText);

    expect(encryptedData).toHaveProperty('encrypted');
    expect(encryptedData).toHaveProperty('iv');
    expect(encryptedData).toHaveProperty('kdfSalt');
    expect(encryptedData).toHaveProperty('tag');
    expect(encryptedData.encrypted).not.toEqual(originalText);

    const decryptedText = encryptionService.decrypt(
      encryptedData.encrypted,
      encryptedData.iv,
      encryptedData.tag,
      encryptedData.kdfSalt
    );

    expect(decryptedText).toEqual(originalText);
  });

  it('should generate different ciphertexts, IVs, and KDF salts for the same plaintext', () => {
    const originalText = 'same-plaintext';

    const encryptedData1 = encryptionService.encrypt(originalText);
    const encryptedData2 = encryptionService.encrypt(originalText);

    expect(encryptedData1.iv).not.toEqual(encryptedData2.iv);
    expect(encryptedData1.kdfSalt).not.toEqual(encryptedData2.kdfSalt);
    expect(encryptedData1.encrypted).not.toEqual(encryptedData2.encrypted);
  });

  it('should decrypt legacy records (null kdfSalt) using SHA-256 fallback', () => {
    // Simula un registro cifrado con el código anterior (SHA-256 sin sal por credencial)
    const { createHash, createCipheriv, randomBytes } = require('node:crypto');
    const legacyKey = createHash('sha256')
      .update('my-secret-access-token-salt-value-123')
      .digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
    let legacyEncrypted = cipher.update('legacy-credential', 'utf8', 'hex');
    legacyEncrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    const decrypted = encryptionService.decrypt(
      legacyEncrypted,
      iv.toString('hex'),
      tag,
      null
    );

    expect(decrypted).toEqual('legacy-credential');
  });
});
