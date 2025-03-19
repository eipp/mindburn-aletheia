import React, { useState, useEffect } from 'react';
import { VerificationTask, HumanVerificationSubmission } from '../types';

interface HumanReviewInterfaceProps {
  task: VerificationTask;
  onSubmit: (verification: HumanVerificationSubmission) => Promise<void>;
  onCancel: () => void;
}

export const HumanReviewInterface: React.FC<HumanReviewInterfaceProps> = ({
  task,
  onSubmit,
  onCancel
}) => {
  const [decision, setDecision] = useState<'accurate' | 'inaccurate' | null>(null);
  const [confidence, setConfidence] = useState<number>(0.8);
  const [issues, setIssues] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAIResults, setShowAIResults] = useState<boolean>(true);
  const [startTime] = useState<number>(Date.now());

  // Common issues for different verification types
  const commonIssues = {
    fact_check: [
      'Incorrect facts',
      'Outdated information',
      'Misleading context',
      'False statement',
      'Partially true, but misleading',
      'Missing critical context',
      'Misinterpreted statistics',
      'Unverifiable claim'
    ],
    content_moderation: [
      'Contains hate speech',
      'Contains violent content',
      'Contains adult content',
      'Contains harmful misinformation',
      'Promotes illegal activity',
      'Contains personal identifiable information',
      'Inappropriately targets vulnerable groups'
    ],
    source_credibility: [
      'Low expertise source',
      'Biased source',
      'Lack of transparency',
      'Poor citation practices',
      'Poor reputation',
      'Conflicts of interest',
      'Contradicts established consensus'
    ]
  };

  // Get appropriate issues based on task type
  const getIssueOptions = () => {
    switch (task.verificationType) {
      case 'fact_check':
        return commonIssues.fact_check;
      case 'content_moderation':
        return commonIssues.content_moderation;
      case 'source_credibility':
        return commonIssues.source_credibility;
      default:
        return [
          ...commonIssues.fact_check,
          ...commonIssues.content_moderation,
          ...commonIssues.source_credibility
        ];
    }
  };

  const handleToggleIssue = (issue: string) => {
    if (issues.includes(issue)) {
      setIssues(issues.filter(i => i !== issue));
    } else {
      setIssues([...issues, issue]);
    }
  };

  const handleSubmit = async () => {
    if (!decision || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const timeSpent = (Date.now() - startTime) / 1000; // in seconds
      
      await onSubmit({
        taskId: task.id,
        flowId: task.flowId,
        decision: decision,
        confidence,
        issues,
        explanation,
        timeSpent,
        submittedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error submitting verification:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    // Handle different content types
    if (task.contentType === 'image_text') {
      return (
        <div className="content-display">
          <div className="image-container">
            <img src={`data:image/jpeg;base64,${task.content}`} alt="Content to verify" />
          </div>
          {task.textContent && (
            <div className="text-content">
              <h4>Text Content:</h4>
              <p>{task.textContent}</p>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="content-display">
          <div className="text-content">
            <p>{task.content}</p>
          </div>
        </div>
      );
    }
  };

  const renderContext = () => {
    if (!task.context) return null;
    
    return (
      <div className="context-panel">
        <h4>Context Information:</h4>
        <p>{task.context}</p>
      </div>
    );
  };

  const renderAIVerification = () => {
    if (!showAIResults || !task.aiResult) return null;
    
    return (
      <div className="ai-results-panel">
        <div className="panel-header">
          <h4>AI Verification Result</h4>
          <button 
            className="toggle-button"
            onClick={() => setShowAIResults(!showAIResults)}
          >
            Hide
          </button>
        </div>
        <div className="ai-result">
          <div className="result-row">
            <span className="label">Decision:</span>
            <span className={`value ${task.aiResult.isAccurate ? 'accurate' : 'inaccurate'}`}>
              {task.aiResult.isAccurate ? 'Accurate' : 'Inaccurate'}
            </span>
          </div>
          <div className="result-row">
            <span className="label">Confidence:</span>
            <span className="value">{(task.aiResult.confidence * 100).toFixed(1)}%</span>
          </div>
          {task.aiResult.explanation && (
            <div className="result-row">
              <span className="label">Explanation:</span>
              <p className="value explanation">{task.aiResult.explanation}</p>
            </div>
          )}
          {task.aiResult.issues && task.aiResult.issues.length > 0 && (
            <div className="result-row">
              <span className="label">Issues Identified:</span>
              <ul className="issues-list">
                {task.aiResult.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="human-review-interface">
      <div className="review-header">
        <h2>Human Verification Task</h2>
        <div className="task-meta">
          <span className="task-type">{task.verificationType}</span>
          <span className="priority">{task.priority > 2 ? 'High Priority' : 'Standard'}</span>
        </div>
      </div>

      <div className="review-content">
        {/* Display the content to verify */}
        {renderContent()}
        
        {/* Display additional context if available */}
        {renderContext()}
        
        {/* Display AI verification result */}
        {renderAIVerification()}
        
        {/* Human verification form */}
        <div className="verification-form">
          <h3>Your Verification</h3>
          
          <div className="decision-buttons">
            <button
              className={`decision-button ${decision === 'accurate' ? 'selected' : ''}`}
              onClick={() => setDecision('accurate')}
            >
              ✓ Accurate
            </button>
            <button
              className={`decision-button ${decision === 'inaccurate' ? 'selected' : ''}`}
              onClick={() => setDecision('inaccurate')}
            >
              ✗ Inaccurate
            </button>
          </div>
          
          <div className="confidence-slider">
            <label>
              Your Confidence: {(confidence * 100).toFixed(0)}%
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
              />
            </label>
          </div>
          
          {decision === 'inaccurate' && (
            <div className="issues-selection">
              <h4>Select Issues:</h4>
              <div className="issues-grid">
                {getIssueOptions().map((issue, index) => (
                  <label key={index} className="issue-checkbox">
                    <input
                      type="checkbox"
                      checked={issues.includes(issue)}
                      onChange={() => handleToggleIssue(issue)}
                    />
                    {issue}
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="explanation-input">
            <h4>Explanation:</h4>
            <textarea
              placeholder="Provide your reasoning or explanation for your decision..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={4}
            />
          </div>
          
          <div className="form-actions">
            <button className="cancel-button" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              className="submit-button" 
              onClick={handleSubmit} 
              disabled={!decision || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 