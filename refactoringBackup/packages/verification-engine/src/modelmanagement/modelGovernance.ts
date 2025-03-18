import { 
  ModelRegistry,
  LoggerService,
  EventBus,
  Policy,
  PolicyRule,
  ComplianceResult,
  PolicyViolation,
  PolicyWarning,
  ValidationResult,
  ModelMetadata,
  AuditReport,
  ModelStatus
} from '@mindburn/shared';
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
  private logger: LoggerService;
  private eventBus: EventBus;
  private policies: Map<string, Policy>;

  constructor(registry: ModelRegistry) {
    this.registry = registry;
    this.logger = new LoggerService();
    this.eventBus = new EventBus();
    this.policies = new Map();
  }

  async addPolicy(policy: Policy): Promise<void> {
    try {
      this.logger.info('Adding policy', { policyId: policy.id });
      PolicySchema.parse(policy);
      this.policies.set(policy.id, policy);

      await this.eventBus.emit('policy.added', {
        policyId: policy.id,
        type: policy.type,
        timestamp: new Date().toISOString()
      });

      this.logger.info('Policy added successfully', { policyId: policy.id });
    } catch (error) {
      this.logger.error('Failed to add policy', {
        policyId: policy.id,
        error
      });
      throw error;
    }
  }

  async evaluateModelCompliance(
    modelId: string,
    version: string
  ): Promise<ComplianceResult> {
    try {
      this.logger.info('Evaluating model compliance', { modelId, version });

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

      const result: ComplianceResult = {
        modelId,
        version,
        timestamp: new Date().toISOString(),
        status: complianceStatus,
        violations,
        warnings,
      };

      await this.eventBus.emit('model.compliance.evaluated', {
        modelId,
        version,
        status: complianceStatus,
        violationCount: violations.length,
        warningCount: warnings.length,
        timestamp: new Date().toISOString()
      });

      this.logger.info('Model compliance evaluated', {
        modelId,
        version,
        status: complianceStatus
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to evaluate model compliance', {
        modelId,
        version,
        error
      });
      throw error;
    }
  }

  async enforcePromotionPolicy(
    modelId: string,
    version: string,
    targetStatus: ModelStatus
  ): Promise<void> {
    try {
      this.logger.info('Enforcing promotion policy', {
        modelId,
        version,
        targetStatus
      });

      const compliance = await this.evaluateModelCompliance(modelId, version);

      if (compliance.status === 'non_compliant') {
        const error = new Error(
          `Cannot promote model ${modelId}@${version} to ${targetStatus} due to policy violations:\n` +
          compliance.violations.map(v => `- ${v.message}`).join('\n')
        );
        this.logger.error('Promotion blocked by policy violations', {
          modelId,
          version,
          targetStatus,
          violations: compliance.violations
        });
        throw error;
      }

      if (compliance.status === 'pending_review' && targetStatus === 'production') {
        const error = new Error(
          `Model ${modelId}@${version} requires review before promotion to production:\n` +
          compliance.warnings.map(w => `- ${w.message}`).join('\n')
        );
        this.logger.error('Promotion blocked pending review', {
          modelId,
          version,
          targetStatus,
          warnings: compliance.warnings
        });
        throw error;
      }

      await this.eventBus.emit('model.promotion.approved', {
        modelId,
        version,
        targetStatus,
        timestamp: new Date().toISOString()
      });

      this.logger.info('Promotion policy check passed', {
        modelId,
        version,
        targetStatus
      });
    } catch (error) {
      this.logger.error('Failed to enforce promotion policy', {
        modelId,
        version,
        targetStatus,
        error
      });
      throw error;
    }
  }

  async scheduleAudit(
    modelId: string,
    version: string,
    auditor: string
  ): Promise<void> {
    try {
      this.logger.info('Scheduling audit', { modelId, version, auditor });

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
        const auditReport: AuditReport = {
          auditor,
          findings: [],
          complianceStatus: 'pending_review',
          riskAssessment: {
            level: model.governance.riskLevel,
            factors: [],
          },
        };

        await this.registry.conductAudit(modelId, version, auditReport);

        await this.eventBus.emit('model.audit.scheduled', {
          modelId,
          version,
          auditor,
          timestamp: new Date().toISOString()
        });

        this.logger.info('Audit scheduled', { modelId, version, auditor });
      } else {
        this.logger.info('Audit not required', { modelId, version });
      }
    } catch (error) {
      this.logger.error('Failed to schedule audit', {
        modelId,
        version,
        auditor,
        error
      });
      throw error;
    }
  }

  async validateModelMetadata(metadata: ModelMetadata): Promise<ValidationResult> {
    try {
      this.logger.info('Validating model metadata', {
        modelId: metadata.modelId,
        version: metadata.version
      });

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

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

      await this.eventBus.emit('model.metadata.validated', {
        modelId: metadata.modelId,
        version: metadata.version,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        timestamp: new Date().toISOString()
      });

      this.logger.info('Model metadata validated', {
        modelId: metadata.modelId,
        version: metadata.version,
        isValid: result.isValid
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to validate model metadata', {
        modelId: metadata.modelId,
        version: metadata.version,
        error
      });
      throw error;
    }
  }

  private async evaluatePolicy(
    policy: Policy,
    model: ModelMetadata
  ): Promise<{
    violations: PolicyViolation[];
    warnings: PolicyWarning[];
  }> {
    try {
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
    } catch (error) {
      this.logger.error('Failed to evaluate policy', {
        policyId: policy.id,
        error
      });
      throw error;
    }
  }

  private evaluateCondition(condition: string, model: ModelMetadata): boolean {
    try {
      // Simple evaluation for demo - in production, use a proper JSON Logic evaluator
      const fn = new Function('model', `return ${condition}`);
      return fn(model);
    } catch (error) {
      this.logger.error('Error evaluating condition', { condition, error });
      return false;
    }
  }
} 