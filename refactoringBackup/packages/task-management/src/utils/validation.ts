import { TaskCreationInput, TaskUrgency } from '../types';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateTaskInput = (input: TaskCreationInput): ValidationResult => {
  const errors: string[] = [];

  // Validate title
  if (!input.title?.trim()) {
    errors.push('Title is required');
  } else if (input.title.length > 100) {
    errors.push('Title must not exceed 100 characters');
  }

  // Validate description
  if (!input.description?.trim()) {
    errors.push('Description is required');
  } else if (input.description.length > 2000) {
    errors.push('Description must not exceed 2000 characters');
  }

  // Validate verification requirements
  if (!input.verificationRequirements) {
    errors.push('Verification requirements are required');
  } else {
    const vr = input.verificationRequirements;

    // Validate required skills
    if (!Array.isArray(vr.requiredSkills) || vr.requiredSkills.length === 0) {
      errors.push('At least one required skill must be specified');
    } else if (vr.requiredSkills.some(skill => typeof skill !== 'string' || !skill.trim())) {
      errors.push('All required skills must be non-empty strings');
    }

    // Validate minimum verifier level
    if (typeof vr.minVerifierLevel !== 'number' || vr.minVerifierLevel < 1 || vr.minVerifierLevel > 10) {
      errors.push('Minimum verifier level must be between 1 and 10');
    }

    // Validate language codes
    if (!Array.isArray(vr.languageCodes) || vr.languageCodes.length === 0) {
      errors.push('At least one language code must be specified');
    } else if (vr.languageCodes.some(code => typeof code !== 'string' || !code.trim())) {
      errors.push('All language codes must be non-empty strings');
    }

    // Validate urgency
    if (!vr.urgency || !Object.values(TaskUrgency).includes(vr.urgency)) {
      errors.push('Valid urgency level is required');
    }

    // Validate verification threshold
    if (typeof vr.verificationThreshold !== 'number' || 
        vr.verificationThreshold < 1 || 
        vr.verificationThreshold > 10) {
      errors.push('Verification threshold must be between 1 and 10');
    }

    // Validate timeout minutes
    if (typeof vr.timeoutMinutes !== 'number' || 
        vr.timeoutMinutes < 5 || 
        vr.timeoutMinutes > 1440) { // Max 24 hours
      errors.push('Timeout must be between 5 minutes and 24 hours');
    }
  }

  // Validate metadata
  if (input.metadata !== undefined) {
    if (typeof input.metadata !== 'object' || Array.isArray(input.metadata)) {
      errors.push('Metadata must be an object');
    } else {
      const metadataSize = JSON.stringify(input.metadata).length;
      if (metadataSize > 4096) { // 4KB limit
        errors.push('Metadata size exceeds 4KB limit');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateTaskType = (type: string): boolean => {
  const validTypes = [
    'GENERAL',
    'IMAGE_VERIFICATION',
    'TEXT_VERIFICATION',
    'CODE_REVIEW',
    'TRANSLATION_REVIEW',
    'CONTENT_MODERATION',
    'FACT_CHECKING'
  ];
  return validTypes.includes(type);
}; 