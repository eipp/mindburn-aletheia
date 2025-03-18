import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
import joblib
import boto3
import json
from typing import Dict, List

class TaskRouter:
    def __init__(self):
        self.feature_columns = [
            'content_type', 'verification_method', 'task_complexity',
            'expected_response_time', 'required_confidence'
        ]
        self.target_column = 'best_worker'
        self.label_encoders = {}
        self.scaler = StandardScaler()
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
    def preprocess_data(self, df: pd.DataFrame) -> tuple:
        """Preprocess the training data."""
        # Encode categorical variables
        for col in ['content_type', 'verification_method']:
            self.label_encoders[col] = LabelEncoder()
            df[col] = self.label_encoders[col].fit_transform(df[col])
            
        X = df[self.feature_columns]
        y = df[self.target_column]
        
        # Scale numerical features
        numerical_cols = ['task_complexity', 'expected_response_time', 'required_confidence']
        X[numerical_cols] = self.scaler.fit_transform(X[numerical_cols])
        
        return X, y
        
    def train(self, training_data: pd.DataFrame) -> None:
        """Train the task routing model."""
        X, y = self.preprocess_data(training_data)
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        self.model.fit(X_train, y_train)
        val_score = self.model.score(X_val, y_val)
        print(f"Validation accuracy: {val_score:.4f}")
        
    def predict_worker(self, task_features: Dict) -> List[str]:
        """Predict the best workers for a given task."""
        # Prepare features
        df = pd.DataFrame([task_features])
        
        for col in ['content_type', 'verification_method']:
            df[col] = self.label_encoders[col].transform(df[col])
            
        numerical_cols = ['task_complexity', 'expected_response_time', 'required_confidence']
        df[numerical_cols] = self.scaler.transform(df[numerical_cols])
        
        # Get worker probabilities
        worker_probs = self.model.predict_proba(df)[0]
        worker_ids = self.label_encoders[self.target_column].classes_
        
        # Return top 3 workers
        top_indices = np.argsort(worker_probs)[-3:][::-1]
        return [worker_ids[i] for i in top_indices]
        
    def save_model(self, bucket: str, key: str) -> None:
        """Save the model to S3."""
        s3 = boto3.client('s3')
        
        # Save model artifacts locally first
        joblib.dump({
            'model': self.model,
            'label_encoders': self.label_encoders,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns
        }, '/tmp/model.joblib')
        
        # Upload to S3
        s3.upload_file('/tmp/model.joblib', bucket, key)
        
    @classmethod
    def load_model(cls, bucket: str, key: str) -> 'TaskRouter':
        """Load the model from S3."""
        s3 = boto3.client('s3')
        s3.download_file(bucket, key, '/tmp/model.joblib')
        
        artifacts = joblib.load('/tmp/model.joblib')
        router = cls()
        router.model = artifacts['model']
        router.label_encoders = artifacts['label_encoders']
        router.scaler = artifacts['scaler']
        router.feature_columns = artifacts['feature_columns']
        
        return router

def lambda_handler(event, context):
    """AWS Lambda handler for task routing."""
    try:
        # Load model from S3
        model_bucket = event['model_bucket']
        model_key = event['model_key']
        router = TaskRouter.load_model(model_bucket, model_key)
        
        # Get task features from event
        task_features = event['task_features']
        
        # Predict best workers
        best_workers = router.predict_worker(task_features)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'best_workers': best_workers,
                'task_id': event['task_features'].get('task_id')
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        } 