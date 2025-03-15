import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { z } from 'zod';
import { SecurityConfig } from './security-config';

const AuthConfigSchema = z.object({
  region: z.string(),
  userPoolId: z.string(),
  clientId: z.string(),
});

export class AuthService {
  private cognito: CognitoIdentityServiceProvider;
  private security: SecurityConfig;
  private config: z.infer<typeof AuthConfigSchema>;

  constructor(
    config: z.infer<typeof AuthConfigSchema>,
    security: SecurityConfig
  ) {
    this.config = AuthConfigSchema.parse(config);
    this.cognito = new CognitoIdentityServiceProvider({ region: config.region });
    this.security = security;
  }

  async authenticateUser(
    username: string,
    password: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    credentials: AWS.Credentials;
  }> {
    const authParams = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.config.clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    };

    const authResult = await this.cognito.initiateAuth(authParams).promise();
    if (!authResult.AuthenticationResult) {
      throw new Error('Authentication failed');
    }

    const credentials = await this.security.getTemporaryCredentials(username);

    return {
      accessToken: authResult.AuthenticationResult.AccessToken,
      refreshToken: authResult.AuthenticationResult.RefreshToken || '',
      credentials,
    };
  }

  async verifyToken(token: string): Promise<{
    username: string;
    groups: string[];
    isValid: boolean;
  }> {
    try {
      const params = {
        AccessToken: token,
      };

      const result = await this.cognito.getUser(params).promise();
      
      const groups = result.UserAttributes
        .find(attr => attr.Name === 'custom:groups')
        ?.Value?.split(',') || [];

      return {
        username: result.Username,
        groups,
        isValid: true,
      };
    } catch (error) {
      return {
        username: '',
        groups: [],
        isValid: false,
      };
    }
  }

  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    credentials: AWS.Credentials;
  }> {
    const params = {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: this.config.clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    };

    const result = await this.cognito.initiateAuth(params).promise();
    if (!result.AuthenticationResult?.AccessToken) {
      throw new Error('Token refresh failed');
    }

    const userInfo = await this.verifyToken(result.AuthenticationResult.AccessToken);
    const credentials = await this.security.getTemporaryCredentials(userInfo.username);

    return {
      accessToken: result.AuthenticationResult.AccessToken,
      credentials,
    };
  }

  async validateUserPermissions(
    username: string,
    requiredPermissions: string[]
  ): Promise<boolean> {
    const params = {
      UserPoolId: this.config.userPoolId,
      Username: username,
    };

    const user = await this.cognito.adminGetUser(params).promise();
    const userGroups = user.UserAttributes
      .find(attr => attr.Name === 'custom:groups')
      ?.Value?.split(',') || [];

    // Check if user has required permissions
    return requiredPermissions.every(permission =>
      userGroups.includes(permission)
    );
  }

  async enforcePermissions(
    username: string,
    requiredPermissions: string[]
  ): Promise<void> {
    const hasPermissions = await this.validateUserPermissions(
      username,
      requiredPermissions
    );

    if (!hasPermissions) {
      throw new Error(
        `User ${username} lacks required permissions: ${requiredPermissions.join(', ')}`
      );
    }
  }
} 