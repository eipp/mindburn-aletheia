import { ModelRegistry } from './model-registry';
import { z } from 'zod';

const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['performance', 'security', 'compliance', 'ethics']),
  rules: z.array(z.object({
    id: z.string(),
    condition: z.string(), // JSON Logic expression
    action: z.enum(['block', 'warn', 'audit']),
    message: z.string(),
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class ModelGovernance {
  private registry: ModelRegistry;
  private policies: Map<string, z.infer<typeof PolicySchema>>;

  constructor(registry: ModelRegistry) {
    this.registry = registry;
    this.policies = new Map();
  }

  async addPolicy(policy: z.infer<typeof PolicySchema>): Promise<void> {
    PolicySchema.parse(policy);
    this.policies.set(policy.id, policy);
  }

  async evaluateModelCompliance(
    modelId: string,
    version: string
  ): Promise<ComplianceResult> {
    const model = await this.registry.getModel(modelId, version);
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    for (const policy of this.policies.values()) {
      const evaluation = await this.evaluatePolicy(policy, model);
      violations.push(...evaluation.violations);
      warnings.push(...evaluation.warnings);
    }

    const complianceStatus = violations.length > 0 ? 'non_compliant' : 
      warnings.length > 0 ? 'pending_review' : 'compliant';

    return {
      modelId,
      version,
      timestamp: new Date().toISOString(),
      status: complianceStatus,
      violations,
      warnings,
    };
  }

  async enforcePromotionPolicy(
    modelId: string,
    version: string,
    targetStatus: 'staging' | 'production'
  ): Promise<void> {
    const compliance = await this.evaluateModelCompliance(modelId, version);

    if (compliance.status === 'non_compliant') {
      throw new Error(
        `Cannot promote model ${modelId}@${version} to ${targetStatus} due to policy violations:\n` +
        compliance.violations.map(v => `- ${v.message}`).join('\n')
      );
    }

    if (compliance.status === 'pending_review' && targetStatus === 'production') {
      throw new Error(
        `Model ${modelId}@${version} requires review before promotion to production:\n` +
        compliance.warnings.map(w => `- ${w.message}`).join('\n')
      );
    }
  }

  async scheduleAudit(
    modelId: string,
    version: string,
    auditor: string
  ): Promise<void> {
    const model = await this.registry.getModel(modelId, version);
    if (!model) {
      throw new Error(`Model not found: ${modelId}@${version}`);
    }

    // Check if audit is required based on policies
    const requiresAudit = Array.from(this.policies.values()).some(policy =>
      policy.rules.some(rule => 
        rule.action === 'audit' && 
        this.evaluateCondition(rule.condition, model)
      )
    );

    if (requiresAudit || model.governance.riskLevel === 'high') {
      await this.registry.conductAudit(modelId, version, {
        auditor,
        findings: [],
        complianceStatus: 'pending_review',
        riskAssessment: {
          level: model.governance.riskLevel,
          factors: [],
        },
      });
    }
  }

  async validateModelMetadata(metadata: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!metadata.name) errors.push('Model name is required');
    if (!metadata.version) errors.push('Model version is required');
    if (!metadata.type) errors.push('Model type is required');

    // Performance metrics validation
    if (metadata.performance) {
      if (metadata.performance.accuracy < 0.8) {
        warnings.push('Model accuracy is below recommended threshold (0.8)');
      }
      if (metadata.performance.latency > 1000) {
        warnings.push('Model latency is above recommended threshold (1000ms)');
      }
    }

    // Governance validation
    if (!metadata.governance?.owner) {
      errors.push('Model owner is required');
    }
    if (!metadata.governance?.approvers?.length) {
      warnings.push('No model approvers specified');
    }

    // Training data validation
    if (metadata.trainingData) {
      if (!metadata.trainingData.dataset) {
        errors.push('Training dataset information is required');
      }
      if (!metadata.trainingData.version) {
        warnings.push('Training dataset version should be specified');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async evaluatePolicy(
    policy: z.infer<typeof PolicySchema>,
    model: any
  ): Promise<{
    violations: PolicyViolation[];
    warnings: PolicyWarning[];
  }> {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    for (const rule of policy.rules) {
      if (this.evaluateCondition(rule.condition, model)) {
        const issue = {
          policyId: policy.id,
          ruleId: rule.id,
          message: rule.message,
          timestamp: new Date().toISOString(),
        };

        if (rule.action === 'block') {
          violations.push(issue);
        } else if (rule.action === 'warn') {
          warnings.push(issue);
        }
      }
    }

    return { violations, warnings };
  }

  private evaluateCondition(condition: string, model: any): boolean {
    try {
      // Simple evaluation for demo - in production, use a proper JSON Logic evaluator
      const fn = new Function('model', `return ${condition}`);
      return fn(model);
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }
}

interface ComplianceResult {
  modelId: string;
  version: string;
  timestamp: string;
  status: 'compliant' | 'pending_review' | 'non_compliant';
  violations: PolicyViolation[];
  warnings: PolicyWarning[];
}

interface PolicyViolation {
  policyId: string;
  ruleId: string;
  message: string;
  timestamp: string;
}

interface PolicyWarning extends PolicyViolation {}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} 