import { PluginManifest, PluginType } from '../core/types';

export interface PluginMetadata extends PluginManifest {
  downloads: number;
  rating: number;
  reviewCount: number;
  lastUpdated: string;
  verified: boolean;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PluginAnalytics {
  pluginId: string;
  activeInstalls: number;
  dailyExecutions: number;
  avgExecutionTime: number;
  errorRate: number;
  lastUpdated: string;
}

export interface SearchOptions {
  type?: PluginType;
  query?: string;
  sort?: 'downloads' | 'rating' | 'newest';
  page?: number;
  limit?: number;
}

export class MarketplaceAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async searchPlugins(options: SearchOptions): Promise<PluginMetadata[]> {
    const response = await this.request('GET', '/plugins/search', options);
    return response.plugins;
  }

  async getPlugin(pluginId: string): Promise<PluginMetadata> {
    const response = await this.request('GET', `/plugins/${pluginId}`);
    return response;
  }

  async publishPlugin(manifest: PluginManifest, packageData: Buffer): Promise<void> {
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('package', new Blob([packageData]));

    await this.request('POST', '/plugins', formData);
  }

  async updatePlugin(pluginId: string, manifest: PluginManifest, packageData: Buffer): Promise<void> {
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('package', new Blob([packageData]));

    await this.request('PUT', `/plugins/${pluginId}`, formData);
  }

  async submitReview(pluginId: string, rating: number, comment: string): Promise<void> {
    await this.request('POST', `/plugins/${pluginId}/reviews`, {
      rating,
      comment,
    });
  }

  async getPluginAnalytics(pluginId: string): Promise<PluginAnalytics> {
    const response = await this.request('GET', `/plugins/${pluginId}/analytics`);
    return response;
  }

  async reportSecurityIssue(pluginId: string, description: string): Promise<void> {
    await this.request('POST', `/plugins/${pluginId}/security-reports`, {
      description,
    });
  }

  private async request(method: string, path: string, data?: unknown): Promise<any> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': data instanceof FormData ? undefined : 'application/json',
      },
      body: data instanceof FormData ? data : JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Marketplace API request failed');
    }

    return response.json();
  }
} 