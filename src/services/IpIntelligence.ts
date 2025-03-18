import { DynamoDB } from 'aws-sdk';
import { Redis } from './Redis';
import axios from 'axios';

interface IpIntelligenceConfig {
  maxmindApiKey: string;
  proxyCheckApiKey: string;
  ipQualityScoreApiKey: string;
  cacheTTL: number;
  riskThresholds: {
    proxy: number;
    datacenter: number;
    abuse: number;
    fraud: number;
  };
}

export class IpIntelligence {
  constructor(
    private dynamodb: DynamoDB.DocumentClient,
    private redis: Redis,
    private config: IpIntelligenceConfig
  ) {}

  async assessIpRisk(ipAddress: string): Promise<number> {
    const cacheKey = `ip_risk:${ipAddress}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const [
      maxmindData,
      proxyCheckData,
      ipQualityData,
      historicalData
    ] = await Promise.all([
      this.getMaxmindData(ipAddress),
      this.getProxyCheckData(ipAddress),
      this.getIpQualityData(ipAddress),
      this.getHistoricalData(ipAddress)
    ]);

    const riskScore = this.calculateRiskScore({
      maxmindData,
      proxyCheckData,
      ipQualityData,
      historicalData
    });

    await Promise.all([
      this.redis.setex(
        cacheKey,
        this.config.cacheTTL,
        JSON.stringify(riskScore)
      ),
      this.updateHistoricalData(ipAddress, riskScore)
    ]);

    return riskScore;
  }

  private async getMaxmindData(ipAddress: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://minfraud.maxmind.com/minfraud/v2.0/score`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(this.config.maxmindApiKey).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          data: {
            ip_address: ipAddress,
            device: {
              session_age: 3600,
              session_id: 'session_id'
            }
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('MaxMind API error:', error);
      return null;
    }
  }

  private async getProxyCheckData(ipAddress: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://proxycheck.io/v2/${ipAddress}`,
        {
          params: {
            key: this.config.proxyCheckApiKey,
            vpn: 1,
            risk: 1,
            port: 1,
            seen: 1,
            days: 7,
            asn: 1,
            node: 1,
            time: 1,
            inf: 1,
            tag: 'fraud_detection'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('ProxyCheck API error:', error);
      return null;
    }
  }

  private async getIpQualityData(ipAddress: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://www.ipqualityscore.com/api/json/ip/${this.config.ipQualityScoreApiKey}/${ipAddress}`,
        {
          params: {
            strictness: 1,
            allow_public_access_points: 'true',
            fast: 'true',
            lighter_penalties: 'false',
            mobile: 'true'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('IPQualityScore API error:', error);
      return null;
    }
  }

  private async getHistoricalData(ipAddress: string): Promise<any> {
    try {
      const result = await this.dynamodb.query({
        TableName: 'IpHistory',
        KeyConditionExpression: 'ipAddress = :ip',
        ExpressionAttributeValues: {
          ':ip': ipAddress
        },
        Limit: 100,
        ScanIndexForward: false
      }).promise();

      return result.Items;
    } catch (error) {
      console.error('Historical data retrieval error:', error);
      return [];
    }
  }

  private calculateRiskScore(data: {
    maxmindData: any;
    proxyCheckData: any;
    ipQualityData: any;
    historicalData: any[];
  }): number {
    const {
      maxmindData,
      proxyCheckData,
      ipQualityData,
      historicalData
    } = data;

    let riskScore = 0;
    let signalCount = 0;

    // MaxMind signals
    if (maxmindData) {
      riskScore += this.evaluateMaxmindRisk(maxmindData);
      signalCount++;
    }

    // ProxyCheck signals
    if (proxyCheckData) {
      riskScore += this.evaluateProxyCheckRisk(proxyCheckData);
      signalCount++;
    }

    // IPQualityScore signals
    if (ipQualityData) {
      riskScore += this.evaluateIpQualityRisk(ipQualityData);
      signalCount++;
    }

    // Historical signals
    if (historicalData.length > 0) {
      riskScore += this.evaluateHistoricalRisk(historicalData);
      signalCount++;
    }

    return signalCount > 0 ? riskScore / signalCount : 0;
  }

  private evaluateMaxmindRisk(data: any): number {
    let risk = 0;

    if (data.risk_score > 90) risk += 1;
    else if (data.risk_score > 75) risk += 0.8;
    else if (data.risk_score > 50) risk += 0.5;
    else if (data.risk_score > 25) risk += 0.3;

    if (data.ip_address.traits.is_datacenter) {
      risk += this.config.riskThresholds.datacenter;
    }

    return Math.min(risk, 1);
  }

  private evaluateProxyCheckRisk(data: any): number {
    let risk = 0;

    if (data.proxy) risk += this.config.riskThresholds.proxy;
    if (data.risk >= 75) risk += 0.8;
    else if (data.risk >= 50) risk += 0.5;
    else if (data.risk >= 25) risk += 0.3;

    return Math.min(risk, 1);
  }

  private evaluateIpQualityRisk(data: any): number {
    let risk = 0;

    if (data.proxy) risk += this.config.riskThresholds.proxy;
    if (data.fraud_score >= 90) risk += 1;
    else if (data.fraud_score >= 75) risk += 0.8;
    else if (data.fraud_score >= 50) risk += 0.5;
    else if (data.fraud_score >= 25) risk += 0.3;

    if (data.recent_abuse) risk += this.config.riskThresholds.abuse;

    return Math.min(risk, 1);
  }

  private evaluateHistoricalRisk(history: any[]): number {
    const recentHistory = history.slice(0, 10);
    const averageRisk = recentHistory.reduce(
      (sum, entry) => sum + entry.riskScore,
      0
    ) / recentHistory.length;

    const fraudulentActivities = recentHistory.filter(
      entry => entry.riskScore >= this.config.riskThresholds.fraud
    ).length;

    const fraudRate = fraudulentActivities / recentHistory.length;

    return Math.min(
      (averageRisk + fraudRate) / 2,
      1
    );
  }

  private async updateHistoricalData(
    ipAddress: string,
    riskScore: number
  ): Promise<void> {
    try {
      await this.dynamodb.put({
        TableName: 'IpHistory',
        Item: {
          ipAddress,
          timestamp: Date.now(),
          riskScore,
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
        }
      }).promise();
    } catch (error) {
      console.error('Historical data update error:', error);
    }
  }
} 