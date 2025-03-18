import { KMS } from 'aws-sdk';
import * as crypto from 'crypto';

export class FieldEncryption {
  private readonly kms: KMS;
  private readonly keyId: string;

  constructor(keyId: string) {
    this.kms = new KMS();
    this.keyId = keyId;
  }

  /**
   * Encrypts sensitive fields in an object using KMS and AES-256-GCM
   */
  async encryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[]
  ): Promise<T> {
    const dataKey = await this.generateDataKey();
    const encryptedData = { ...data };

    for (const field of sensitiveFields) {
      if (field in data) {
        const encrypted = await this.encryptField(
          data[field],
          dataKey.Plaintext as Buffer
        );
        encryptedData[field] = {
          encrypted: encrypted.encryptedData,
          iv: encrypted.iv.toString('base64'),
          tag: encrypted.tag.toString('base64'),
          encryptedKey: dataKey.CiphertextBlob.toString('base64')
        };
      }
    }

    return encryptedData;
  }

  /**
   * Decrypts sensitive fields in an object using KMS and AES-256-GCM
   */
  async decryptFields<T extends Record<string, any>>(
    data: T,
    sensitiveFields: string[]
  ): Promise<T> {
    const decryptedData = { ...data };

    for (const field of sensitiveFields) {
      if (field in data && typeof data[field] === 'object') {
        const encryptedField = data[field];
        const dataKey = await this.decryptDataKey(
          Buffer.from(encryptedField.encryptedKey, 'base64')
        );
        
        const decrypted = await this.decryptField(
          encryptedField.encrypted,
          dataKey,
          Buffer.from(encryptedField.iv, 'base64'),
          Buffer.from(encryptedField.tag, 'base64')
        );
        
        decryptedData[field] = decrypted;
      }
    }

    return decryptedData;
  }

  private async generateDataKey(): Promise<KMS.GenerateDataKeyResponse> {
    return this.kms
      .generateDataKey({
        KeyId: this.keyId,
        KeySpec: 'AES_256'
      })
      .promise();
  }

  private async decryptDataKey(encryptedKey: Buffer): Promise<Buffer> {
    const response = await this.kms
      .decrypt({
        CiphertextBlob: encryptedKey,
        KeyId: this.keyId
      })
      .promise();
    
    return response.Plaintext as Buffer;
  }

  private async encryptField(
    data: any,
    key: Buffer
  ): Promise<{
    encryptedData: string;
    iv: Buffer;
    tag: Buffer;
  }> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);

    return {
      encryptedData: encrypted.toString('base64'),
      iv,
      tag: cipher.getAuthTag()
    };
  }

  private async decryptField(
    encryptedData: string,
    key: Buffer,
    iv: Buffer,
    tag: Buffer
  ): Promise<any> {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'base64')),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }
} 