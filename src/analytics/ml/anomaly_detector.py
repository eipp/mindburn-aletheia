import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import pandas as pd
import boto3
import json
from typing import Dict, List, Tuple
import joblib

class AnomalyDetector:
    def __init__(self, contamination: float = 0.1):
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        self.scaler = StandardScaler()
        self.feature_columns = [
            'response_time_ms',
            'confidence_score',
            'cost',
            'accuracy_rate'
        ]
        
    def preprocess_data(self, df: pd.DataFrame) -> np.ndarray:
        """Preprocess data for anomaly detection."""
        # Calculate rolling metrics
        df['accuracy_rate'] = df['is_accurate'].rolling(window=10).mean()
        df = df.dropna()  # Remove rows with NaN from rolling window
        
        # Select and scale features
        features = df[self.feature_columns]
        scaled_features = self.scaler.fit_transform(features)
        return scaled_features
        
    def train(self, data: pd.DataFrame) -> None:
        """Train the anomaly detection model."""
        scaled_features = self.preprocess_data(data)
        self.model.fit(scaled_features)
        
    def detect_anomalies(self, data: pd.DataFrame) -> Tuple[List[bool], List[float]]:
        """Detect anomalies in verification data."""
        scaled_features = self.preprocess_data(data)
        
        # -1 for anomalies, 1 for normal points
        predictions = self.model.predict(scaled_features)
        # Convert to boolean (True for anomalies)
        anomalies = predictions == -1
        
        # Get anomaly scores (-1 to 1, lower means more anomalous)
        scores = self.model.score_samples(scaled_features)
        
        return anomalies, scores

def lambda_handler(event, context):
    """AWS Lambda handler for anomaly detection."""
    try:
        # Initialize S3 client
        s3 = boto3.client('s3')
        
        # Load model from S3
        model_bucket = event['model_bucket']
        model_key = event['model_key']
        s3.download_file(model_bucket, model_key, '/tmp/anomaly_model.joblib')
        
        # Load verification data
        data = pd.DataFrame(event['verification_data'])
        
        # Initialize and load model
        detector = AnomalyDetector()
        detector.model = joblib.load('/tmp/anomaly_model.joblib')
        
        # Detect anomalies
        anomalies, scores = detector.detect_anomalies(data)
        
        # Prepare response
        anomaly_indices = np.where(anomalies)[0].tolist()
        anomaly_scores = scores[anomalies].tolist()
        
        response_data = {
            'anomaly_count': len(anomaly_indices),
            'anomalies': [{
                'index': idx,
                'score': score,
                'timestamp': data.iloc[idx]['timestamp'],
                'metrics': {
                    col: data.iloc[idx][col] 
                    for col in detector.feature_columns
                }
            } for idx, score in zip(anomaly_indices, anomaly_scores)]
        }
        
        return {
            'statusCode': 200,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

# Training script (to be run in SageMaker notebook)
def train_anomaly_detector(data_path: str, model_bucket: str, model_key: str):
    """Train and save anomaly detection model."""
    # Load historical data
    data = pd.read_parquet(data_path)
    
    # Initialize and train detector
    detector = AnomalyDetector()
    detector.train(data)
    
    # Save model to S3
    s3 = boto3.client('s3')
    joblib.dump(detector.model, '/tmp/anomaly_model.joblib')
    s3.upload_file('/tmp/anomaly_model.joblib', model_bucket, model_key) 