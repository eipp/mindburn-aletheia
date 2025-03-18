import { Logger } from '@mindburn/shared/logger';
import { IdentityVerification } from '../types';
import axios from 'axios';
import { createHash } from 'crypto';

interface KYCProvider {
  verifyIdentity(data: any): Promise<{
    verified: boolean;
    score: number;
    details: any;
  }>;
}

class SumsubKYCProvider implements KYCProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(apiKey: string, apiUrl: string) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async verifyIdentity(data: any): Promise<{
    verified: boolean;
    score: number;
    details: any;
  }> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/resources/applicants`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        verified: response.data.review.reviewStatus === 'completed',
        score: response.data.review.score || 0,
        details: response.data
      };
    } catch (error) {
      throw new Error(`Sumsub verification failed: ${error.message}`);
    }
  }
}

export class IdentityVerificationService {
  private readonly logger: Logger;
  private readonly kycProvider: KYCProvider;
  private readonly fraudDetectionEnabled: boolean;
  private readonly verificationCache: Map<string, {
    timestamp: number;
    result: IdentityVerification;
  }>;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    logger: Logger,
    kycProvider: KYCProvider,
    fraudDetectionEnabled: boolean = true
  ) {
    this.logger = logger.child({ service: 'IdentityVerification' });
    this.kycProvider = kycProvider;
    this.fraudDetectionEnabled = fraudDetectionEnabled;
    this.verificationCache = new Map();
  }

  async verifyIdentity(
    workerId: string,
    identityData: {
      documentType: string;
      documentNumber: string;
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      nationality: string;
      documentImages: string[];
      selfieImage?: string;
    }
  ): Promise<IdentityVerification> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(workerId, identityData);
      const cachedResult = this.verificationCache.get(cacheKey);
      
      if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL) {
        this.logger.info('Using cached identity verification result', { workerId });
        return cachedResult.result;
      }

      // Validate input data
      this.validateIdentityData(identityData);

      // Check for potential fraud if enabled
      if (this.fraudDetectionEnabled) {
        await this.detectPotentialFraud(identityData);
      }

      // Perform KYC verification
      const kycResult = await this.kycProvider.verifyIdentity({
        externalUserId: workerId,
        info: {
          firstName: identityData.firstName,
          lastName: identityData.lastName,
          dateOfBirth: identityData.dateOfBirth,
          nationality: identityData.nationality
        },
        documents: {
          idCard: identityData.documentImages,
          selfie: identityData.selfieImage
        }
      });

      const verificationResult: IdentityVerification = {
        status: kycResult.verified ? 'VERIFIED' : 'REJECTED',
        method: 'KYC',
        timestamp: new Date().toISOString(),
        metadata: {
          documentType: identityData.documentType,
          documentNumber: this.hashSensitiveData(identityData.documentNumber),
          verificationScore: kycResult.score,
          provider: 'sumsub',
          details: kycResult.details
        }
      };

      // Cache the result
      this.verificationCache.set(cacheKey, {
        timestamp: Date.now(),
        result: verificationResult
      });

      this.logger.info('Identity verification completed', {
        workerId,
        status: verificationResult.status,
        score: kycResult.score
      });

      return verificationResult;

    } catch (error) {
      this.logger.error('Identity verification failed', {
        error,
        workerId
      });
      throw error;
    }
  }

  async validateDocumentExpiry(
    workerId: string,
    documentData: {
      documentType: string;
      expiryDate: string;
    }
  ): Promise<boolean> {
    try {
      const expiryDate = new Date(documentData.expiryDate);
      const currentDate = new Date();
      
      // Add 3 months buffer for document expiry
      const bufferDate = new Date(currentDate);
      bufferDate.setMonth(currentDate.getMonth() + 3);

      const isValid = expiryDate > bufferDate;

      this.logger.info('Document expiry validation completed', {
        workerId,
        documentType: documentData.documentType,
        isValid
      });

      return isValid;

    } catch (error) {
      this.logger.error('Document expiry validation failed', {
        error,
        workerId
      });
      throw error;
    }
  }

  private validateIdentityData(data: any): void {
    const requiredFields = [
      'documentType',
      'documentNumber',
      'firstName',
      'lastName',
      'dateOfBirth',
      'nationality',
      'documentImages'
    ];

    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (!Array.isArray(data.documentImages) || data.documentImages.length === 0) {
      throw new Error('Document images are required');
    }

    // Validate date format
    if (!this.isValidDate(data.dateOfBirth)) {
      throw new Error('Invalid date of birth format');
    }
  }

  private async detectPotentialFraud(data: any): Promise<void> {
    // Implement fraud detection logic here
    // This could include:
    // 1. Check for duplicate documents
    // 2. Validate document authenticity
    // 3. Check against fraud database
    // 4. Image manipulation detection
    // 5. Face recognition for selfie verification
    
    // For now, this is a placeholder
    this.logger.info('Fraud detection check completed');
  }

  private generateCacheKey(workerId: string, data: any): string {
    const dataString = JSON.stringify({
      workerId,
      documentNumber: data.documentNumber,
      dateOfBirth: data.dateOfBirth
    });
    return createHash('sha256').update(dataString).digest('hex');
  }

  private hashSensitiveData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
} 