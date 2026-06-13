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
    expect(encryptedData).toHaveProperty('tag');
    expect(encryptedData.encrypted).not.toEqual(originalText);

    const decryptedText = encryptionService.decrypt(
      encryptedData.encrypted,
      encryptedData.iv,
      encryptedData.tag
    );

    expect(decryptedText).toEqual(originalText);
  });

  it('should generate different ciphertexts and IVs for the same plaintext', () => {
    const originalText = 'same-plaintext';

    const encryptedData1 = encryptionService.encrypt(originalText);
    const encryptedData2 = encryptionService.encrypt(originalText);

    expect(encryptedData1.iv).not.toEqual(encryptedData2.iv);
    expect(encryptedData1.encrypted).not.toEqual(encryptedData2.encrypted);
  });
});
