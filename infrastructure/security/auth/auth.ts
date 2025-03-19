import { Cognito, CognitoIdentityServiceProvider } from 'aws-sdk';
import * as jwt from 'jsonwebtoken';
import { MfaAuthStack } from './mfaconfig';

// Add JwtPayload interface
export interface JwtPayload {
  sub: string;
  email?: string;
  developerId?: string;
  exp: number;
  iat: number;
  token_use: string;
  iss: string;
  aud?: string;
  [key: string]: any;
}

export interface AuthConfig {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  tokenUse: 'id' | 'access';
  enforceAudience?: boolean;
}

export class AuthService {
  private cognito: CognitoIdentityServiceProvider;
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.cognito = new CognitoIdentityServiceProvider({ region: config.region });
  }

  /**
   * Authenticate a user and initiate MFA challenge if enabled
   */
  async authenticate(username: string, password: string): Promise<any> {
    try {
      const authParams = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.config.userPoolClientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      };

      const response = await this.cognito.initiateAuth(authParams).promise();
      
      if (response.ChallengeName === 'SMS_MFA' || response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        return {
          challengeName: response.ChallengeName,
          session: response.Session,
          message: 'MFA code required'
        };
      }

      return {
        tokens: {
          idToken: response.AuthenticationResult?.IdToken,
          accessToken: response.AuthenticationResult?.AccessToken,
          refreshToken: response.AuthenticationResult?.RefreshToken,
        },
        expiresIn: response.AuthenticationResult?.ExpiresIn,
      };
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Complete MFA challenge
   */
  async completeMfaChallenge(username: string, code: string, session: string): Promise<any> {
    try {
      const challengeParams = {
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        ClientId: this.config.userPoolClientId,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: code,
        },
        Session: session,
      };

      const response = await this.cognito.respondToAuthChallenge(challengeParams).promise();
      
      return {
        tokens: {
          idToken: response.AuthenticationResult?.IdToken,
          accessToken: response.AuthenticationResult?.AccessToken,
          refreshToken: response.AuthenticationResult?.RefreshToken,
        },
        expiresIn: response.AuthenticationResult?.ExpiresIn,
      };
    } catch (error) {
      console.error('MFA challenge error:', error);
      throw new Error('MFA verification failed');
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(refreshToken: string): Promise<any> {
    try {
      const refreshParams = {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.config.userPoolClientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      };

      const response = await this.cognito.initiateAuth(refreshParams).promise();
      
      return {
        tokens: {
          idToken: response.AuthenticationResult?.IdToken,
          accessToken: response.AuthenticationResult?.AccessToken,
        },
        expiresIn: response.AuthenticationResult?.ExpiresIn,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw new Error('Token refresh failed');
    }
  }

  /**
   * Verify JWT token from requests
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      // Decode the JWT to verify structure and claims
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded || !decoded.header || !decoded.payload) {
        throw new Error('Invalid token structure');
      }

      const tokenSections = token.split('.');
      if (tokenSections.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = decoded.payload as JwtPayload;

      // Verify token expiration
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (payload.exp <= currentTimestamp) {
        throw new Error('Token expired');
      }

      // Verify audience if required
      if (this.config.enforceAudience && payload.aud !== this.config.userPoolClientId) {
        throw new Error('Token audience mismatch');
      }

      // Verify token use
      if (payload.token_use !== this.config.tokenUse) {
        throw new Error('Invalid token use');
      }

      // AWS Cognito specific validation
      if (payload.iss !== `https://cognito-idp.${this.config.region}.amazonaws.com/${this.config.userPoolId}`) {
        throw new Error('Invalid token issuer');
      }

      return payload;
    } catch (error) {
      console.error('Token verification error:', error);
      throw new Error('Token verification failed');
    }
  }

  /**
   * Sign out a user (revoke tokens)
   */
  async signOut(accessToken: string): Promise<void> {
    try {
      await this.cognito.globalSignOut({ AccessToken: accessToken }).promise();
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Sign out failed');
    }
  }

  /**
   * Set up TOTP MFA for a user
   */
  async setupTotpMfa(accessToken: string): Promise<{ secretCode: string, qrCodeUrl: string }> {
    try {
      const result = await this.cognito.associateSoftwareToken({ AccessToken: accessToken }).promise();
      
      return {
        secretCode: result.SecretCode || '',
        qrCodeUrl: `otpauth://totp/Mindburn:${result.SecretCode}?secret=${result.SecretCode}&issuer=Mindburn`
      };
    } catch (error) {
      console.error('TOTP setup error:', error);
      throw new Error('Failed to set up TOTP MFA');
    }
  }

  /**
   * Verify and activate TOTP MFA
   */
  async verifyTotpMfa(accessToken: string, totpCode: string): Promise<boolean> {
    try {
      const result = await this.cognito.verifySoftwareToken({
        AccessToken: accessToken,
        UserCode: totpCode,
      }).promise();
      
      return result.Status === 'SUCCESS';
    } catch (error) {
      console.error('TOTP verification error:', error);
      throw new Error('Failed to verify TOTP code');
    }
  }

  /**
   * Enable MFA for a user
   */
  async enableMfa(accessToken: string): Promise<void> {
    try {
      await this.cognito.setUserMFAPreference({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true,
        },
      }).promise();
    } catch (error) {
      console.error('Enable MFA error:', error);
      throw new Error('Failed to enable MFA');
    }
  }
}

/**
 * Create an auth middleware for Express applications
 */
export function createAuthMiddleware(config: AuthConfig) {
  const authService = new AuthService(config);
  
  return async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Missing authorization header' });
      }
      
      const token = authHeader.split(' ')[1];
      const decodedToken: JwtPayload = await authService.verifyToken(token);
      
      // Attach user information to request
      req.user = {
        sub: decodedToken.sub,
        username: decodedToken['cognito:username'],
        groups: decodedToken['cognito:groups'] || [],
        email: decodedToken.email,
      };
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
  };
}

/**
 * Create auth middleware with role-based authorization
 */
export function createRoleAuthMiddleware(config: AuthConfig, allowedRoles: string[]) {
  const authMiddleware = createAuthMiddleware(config);
  
  return async (req: any, res: any, next: any) => {
    // First authenticate the user
    const authMiddlewareWrapper = (err: any) => {
      if (err) return next(err);
      
      // Then check if user has required role
      const userGroups = req.user.groups || [];
      const hasRole = userGroups.some((group: string) => allowedRoles.includes(group));
      
      if (!hasRole) {
        return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      }
      
      next();
    };
    
    authMiddleware(req, res, authMiddlewareWrapper);
  };
} 