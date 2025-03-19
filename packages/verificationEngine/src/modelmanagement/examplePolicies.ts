export const performancePolicy = {
  id: 'performance_requirements',
  name: 'Model Performance Requirements',
  description: 'Enforces minimum performance standards for models',
  type: 'performance',
  rules: [
    {
      id: 'min_accuracy',
      condition: 'model.performance.accuracy < 0.9',
      action: 'block',
      message: 'Model accuracy must be at least 90% for production deployment',
    },
    {
      id: 'min_confidence',
      condition: 'model.performance.confidence < 0.85',
      action: 'warn',
      message: 'Model confidence is below recommended threshold of 85%',
    },
    {
      id: 'max_latency',
      condition: 'model.performance.latency > 1000',
      action: 'warn',
      message: 'Model latency exceeds recommended threshold of 1000ms',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const securityPolicy = {
  id: 'security_requirements',
  name: 'Model Security Requirements',
  description: 'Enforces security standards for model deployment',
  type: 'security',
  rules: [
    {
      id: 'high_risk_audit',
      condition: 'model.governance.riskLevel === "high"',
      action: 'audit',
      message: 'High-risk models require security audit before deployment',
    },
    {
      id: 'approvers_required',
      condition: '!model.governance.approvers || model.governance.approvers.length < 2',
      action: 'block',
      message: 'At least two approvers are required for model deployment',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const compliancePolicy = {
  id: 'compliance_requirements',
  name: 'Model Compliance Requirements',
  description: 'Enforces compliance standards for regulated domains',
  type: 'compliance',
  rules: [
    {
      id: 'training_data_version',
      condition: '!model.trainingData.version',
      action: 'block',
      message: 'Training data version must be specified for compliance tracking',
    },
    {
      id: 'dataset_documentation',
      condition: '!model.trainingData.dataset',
      action: 'block',
      message: 'Training dataset documentation is required for compliance',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const ethicsPolicy = {
  id: 'ethics_requirements',
  name: 'Model Ethics Requirements',
  description: 'Enforces ethical standards for AI models',
  type: 'ethics',
  rules: [
    {
      id: 'bias_monitoring',
      condition: 'model.performance.biasScore > 0.1',
      action: 'block',
      message: 'Model exhibits significant bias and requires mitigation',
    },
    {
      id: 'fairness_check',
      condition: 'model.performance.fairnessScore < 0.9',
      action: 'warn',
      message: 'Model fairness score is below recommended threshold',
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
