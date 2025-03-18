import { KMS } from 'aws-sdk';
import { promisify } from 'util';
import { randomBytes } from 'crypto';

const kms = new KMS();
const randomBytesAsync = promisify(randomBytes);

interface EncryptedData {
  encryptedData: string;
  encryptedKey: string;
  iv: string;
}

export class FieldEncryption {
  private readonly kmsKeyId: string;

  constructor() {
    const kmsKeyId = process.env.KMS_KEY_ID;
    if (!kmsKeyId) {
      throw new Error('KMS_KEY_ID environment variable is not set');
    }
    this.kmsKeyId = kmsKeyId;
  }

  async encrypt(data: string): Promise<EncryptedData> {
    try {
      // Generate a data key
      const { Plaintext, CiphertextBlob } = await kms
        .generateDataKey({
          KeyId: this.kmsKeyId,
          KeySpec: 'AES_256',
        })
        .promise();

      if (!Plaintext || !CiphertextBlob) {
        throw new Error('Failed to generate data key');
      }

      // Generate random IV
      const iv = await randomBytesAsync(16);

      // Encrypt the data
      const crypto = require('crypto');
      const cipher = crypto.createCipheriv('aes-256-gcm', Plaintext, iv);

      let encryptedData = cipher.update(data, 'utf8', 'base64');
      encryptedData += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      // Combine encrypted data with auth tag
      const finalEncryptedData = Buffer.concat([
        Buffer.from(encryptedData, 'base64'),
        authTag,
      ]).toString('base64');

      return {
        encryptedData: finalEncryptedData,
        encryptedKey: CiphertextBlob.toString('base64'),
        iv: iv.toString('base64'),
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  async decrypt(encryptedData: EncryptedData): Promise<string> {
    try {
      // Decrypt the data key
      const { Plaintext } = await kms
        .decrypt({
          CiphertextBlob: Buffer.from(encryptedData.encryptedKey, 'base64'),
        })
        .promise();

      if (!Plaintext) {
        throw new Error('Failed to decrypt data key');
      }

      // Split encrypted data and auth tag
      const encryptedBuffer = Buffer.from(encryptedData.encryptedData, 'base64');
      const authTag = encryptedBuffer.slice(-16);
      const data = encryptedBuffer.slice(0, -16);

      // Decrypt the data
      const crypto = require('crypto');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Plaintext,
        Buffer.from(encryptedData.iv, 'base64')
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(data, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  async encryptObject<T extends object>(obj: T): Promise<T> {
    const encryptedObj = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldEncrypt(key) && typeof value === 'string') {
        const encrypted = await this.encrypt(value);
        (encryptedObj as any)[key] = encrypted;
      }
    }

    return encryptedObj;
  }

  async decryptObject<T extends object>(obj: T): Promise<T> {
    const decryptedObj = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldEncrypt(key) && this.isEncryptedData(value)) {
        const decrypted = await this.decrypt(value as EncryptedData);
        (decryptedObj as any)[key] = decrypted;
      }
    }

    return decryptedObj;
  }

  private shouldEncrypt(fieldName: string): boolean {
    const sensitiveFields = [
      'walletAddress',
      'email',
      'phoneNumber',
      'personalData',
      'apiKey',
      'secret',
    ];
    return sensitiveFields.includes(fieldName);
  }

  private isEncryptedData(value: any): value is EncryptedData {
    return (
      value &&
      typeof value === 'object' &&
      'encryptedData' in value &&
      'encryptedKey' in value &&
      'iv' in value
    );
  }
}
