export declare class FieldEncryption {
    private readonly kms;
    private readonly keyId;
    constructor(keyId: string);
    /**
     * Encrypts sensitive fields in an object using KMS and AES-256-GCM
     */
    encryptFields<T extends Record<string, any>>(data: T, sensitiveFields: string[]): Promise<T>;
    /**
     * Decrypts sensitive fields in an object using KMS and AES-256-GCM
     */
    decryptFields<T extends Record<string, any>>(data: T, sensitiveFields: string[]): Promise<T>;
    private generateDataKey;
    private decryptDataKey;
    private encryptField;
    private decryptField;
}
