import json
import os
import boto3
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
MODEL_BUCKET = os.environ.get('MODEL_BUCKET', '')
MODEL_KEY = os.environ.get('MODEL_KEY', 'models/anomaly_detector/model.joblib')
ALERT_TOPIC_ARN = os.environ.get('ALERT_TOPIC_ARN', '')
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb_client = boto3.client('dynamodb')
cloudwatch_client = boto3.client('cloudwatch')
sns_client = boto3.client('sns')

def lambda_handler(event, context):
    """
    Anomaly detection handler for verification metrics
    """
    logger.info(f"Processing anomaly detection event: {json.dumps(event)}")
    
    try:
        # Extract configuration from event
        sensitivity = event.get('sensitivity', 'medium')
        lookback_hours = _get_lookback_hours(sensitivity)
        
        # Load recent verification data
        metrics_data = _load_recent_metrics(lookback_hours)
        
        if not metrics_data:
            logger.info("No metrics data found for analysis")
            return {
                'statusCode': 200,
                'body': {
                    'message': 'No metrics data found for analysis',
                    'anomaliesDetected': 0
                }
            }
        
        # Detect anomalies
        anomalies = _detect_anomalies(metrics_data, sensitivity)
        
        if anomalies:
            # Log anomalies to CloudWatch
            _log_anomalies_to_cloudwatch(anomalies)
            
            # Send alert if configured
            if ALERT_TOPIC_ARN:
                _send_anomaly_alert(anomalies)
        
        return {
            'statusCode': 200,
            'body': {
                'message': f"Analyzed {len(metrics_data)} metrics datapoints",
                'anomaliesDetected': len(anomalies),
                'sensitivity': sensitivity
            }
        }
    except Exception as e:
        logger.error(f"Error in anomaly detection: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': {
                'message': 'Error in anomaly detection',
                'error': str(e)
            }
        }

def _get_lookback_hours(sensitivity: str) -> int:
    """
    Get lookback hours based on sensitivity
    """
    sensitivity_map = {
        'low': 24,      # 24 hours
        'medium': 12,   # 12 hours
        'high': 4       # 4 hours
    }
    return sensitivity_map.get(sensitivity.lower(), 12)

def _load_recent_metrics(lookback_hours: int) -> List[Dict[str, Any]]:
    """
    Load recent verification metrics from DynamoDB
    """
    # This is a simplified implementation
    # In a real implementation, we would query the metrics table
    # with proper indexes and time filters
    
    # Simulate loading metrics data
    # In production, this would be replaced with actual DynamoDB queries
    
    # Example metrics data structure
    metrics = [
        {
            "task_id": f"task{i}",
            "worker_id": f"worker{i % 10}",
            "content_type": "text" if i % 3 == 0 else "image" if i % 3 == 1 else "video",
            "verification_method": "human" if i % 2 == 0 else "ai",
            "confidence_score": np.random.uniform(0.6, 0.99),
            "response_time_ms": np.random.randint(200, 10000),
            "is_accurate": i % 7 != 0,  # Introduce some inaccuracies
            "timestamp": pd.Timestamp.now() - pd.Timedelta(hours=np.random.randint(0, lookback_hours))
        }
        for i in range(100)  # Sample size
    ]
    
    return metrics

def _detect_anomalies(metrics_data: List[Dict[str, Any]], sensitivity: str) -> List[Dict[str, Any]]:
    """
    Detect anomalies in the metrics data
    """
    # Convert to DataFrame for easier analysis
    df = pd.DataFrame(metrics_data)
    
    # Calculate thresholds based on sensitivity
    threshold_map = {
        'low': 3.0,     # 3 standard deviations 
        'medium': 2.5,  # 2.5 standard deviations
        'high': 2.0     # 2 standard deviations
    }
    sigma_threshold = threshold_map.get(sensitivity.lower(), 2.5)
    
    anomalies = []
    
    # Analyze response times
    mean_response_time = df['response_time_ms'].mean()
    std_response_time = df['response_time_ms'].std()
    upper_threshold = mean_response_time + (sigma_threshold * std_response_time)
    
    response_time_anomalies = df[df['response_time_ms'] > upper_threshold]
    if not response_time_anomalies.empty:
        anomalies.append({
            'type': 'HIGH_RESPONSE_TIME',
            'count': len(response_time_anomalies),
            'threshold': upper_threshold,
            'average': mean_response_time,
            'severity': 'MEDIUM',
            'affectedWorkers': response_time_anomalies['worker_id'].nunique(),
            'message': f"Detected {len(response_time_anomalies)} responses with unusually high response times"
        })
    
    # Analyze accuracy
    accuracy_rate = df['is_accurate'].mean()
    if accuracy_rate < 0.75:  # Threshold for low accuracy
        anomalies.append({
            'type': 'LOW_ACCURACY',
            'value': accuracy_rate,
            'threshold': 0.75,
            'severity': 'HIGH' if accuracy_rate < 0.6 else 'MEDIUM',
            'message': f"Low verification accuracy rate: {accuracy_rate:.2%}"
        })
    
    # Analyze by content type
    content_type_stats = df.groupby('content_type').agg({
        'is_accurate': 'mean', 
        'response_time_ms': 'mean',
        'task_id': 'count'
    }).rename(columns={'task_id': 'count'})
    
    for content_type, stats in content_type_stats.iterrows():
        if stats['count'] >= 10 and stats['is_accurate'] < 0.7:
            anomalies.append({
                'type': 'CONTENT_TYPE_LOW_ACCURACY',
                'contentType': content_type,
                'value': stats['is_accurate'],
                'count': stats['count'],
                'threshold': 0.7,
                'severity': 'HIGH' if stats['is_accurate'] < 0.5 else 'MEDIUM',
                'message': f"Low accuracy rate ({stats['is_accurate']:.2%}) for content type {content_type}"
            })
    
    return anomalies

def _log_anomalies_to_cloudwatch(anomalies: List[Dict[str, Any]]) -> None:
    """
    Log anomalies as CloudWatch metrics
    """
    metric_data = []
    
    for anomaly in anomalies:
        metric_name = f"Anomaly{anomaly['type']}"
        dimensions = [{'Name': 'Environment', 'Value': ENVIRONMENT}]
        
        if 'contentType' in anomaly:
            dimensions.append({'Name': 'ContentType', 'Value': anomaly['contentType']})
        
        metric_data.append({
            'MetricName': metric_name,
            'Dimensions': dimensions,
            'Value': 1,  # Count of anomaly
            'Unit': 'Count'
        })
        
        # Add value metric if present
        if 'value' in anomaly:
            metric_data.append({
                'MetricName': f"{anomaly['type']}Value",
                'Dimensions': dimensions,
                'Value': anomaly['value'],
                'Unit': 'None'
            })
    
    if metric_data:
        cloudwatch_client.put_metric_data(
            Namespace='Mindburn/AnomalyDetection',
            MetricData=metric_data
        )

def _send_anomaly_alert(anomalies: List[Dict[str, Any]]) -> None:
    """
    Send anomaly alerts to SNS
    """
    high_severity_anomalies = [a for a in anomalies if a.get('severity') == 'HIGH']
    
    if high_severity_anomalies:
        subject = f"[{ENVIRONMENT.upper()}] Verification System Anomalies Detected"
        
        message = {
            'subject': subject,
            'anomalies': high_severity_anomalies,
            'timestamp': pd.Timestamp.now().isoformat(),
            'environment': ENVIRONMENT,
            'alertSummary': '\n'.join([f"- {a['message']}" for a in high_severity_anomalies]),
        }
        
        sns_client.publish(
            TopicArn=ALERT_TOPIC_ARN,
            Subject=subject,
            Message=json.dumps(message, indent=2)
        ) 