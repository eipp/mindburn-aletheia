-- Verification Accuracy by Task Type
SELECT 
    content_type,
    verification_method,
    COUNT(*) as total_verifications,
    SUM(CASE WHEN is_accurate THEN 1 ELSE 0 END) as accurate_verifications,
    CAST(SUM(CASE WHEN is_accurate THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) as accuracy_rate
FROM verification_metrics
GROUP BY content_type, verification_method
ORDER BY content_type, accuracy_rate DESC;

-- Worker Performance Metrics
SELECT 
    worker_id,
    COUNT(*) as total_tasks,
    AVG(response_time_ms) as avg_response_time,
    AVG(confidence_score) as avg_confidence,
    CAST(SUM(CASE WHEN is_accurate THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) as accuracy_rate,
    AVG(cost) as avg_cost_per_task
FROM verification_metrics
GROUP BY worker_id
HAVING total_tasks >= 10
ORDER BY accuracy_rate DESC;

-- Response Time Distribution
SELECT 
    CASE 
        WHEN response_time_ms < 1000 THEN '<1s'
        WHEN response_time_ms < 5000 THEN '1-5s'
        WHEN response_time_ms < 10000 THEN '5-10s'
        ELSE '>10s'
    END as response_time_bucket,
    COUNT(*) as count,
    AVG(is_accurate::int) as accuracy_rate
FROM verification_metrics
GROUP BY response_time_bucket
ORDER BY response_time_bucket;

-- Confidence Score Analysis
SELECT 
    FLOOR(confidence_score * 10) / 10 as confidence_bucket,
    COUNT(*) as total_predictions,
    AVG(is_accurate::int) as actual_accuracy,
    ABS(FLOOR(confidence_score * 10) / 10 - AVG(is_accurate::int)) as calibration_error
FROM verification_metrics
GROUP BY confidence_bucket
ORDER BY confidence_bucket;

-- Cost Analysis by Method
SELECT 
    verification_method,
    content_type,
    COUNT(*) as total_verifications,
    AVG(cost) as avg_cost,
    SUM(cost) as total_cost,
    SUM(CASE WHEN is_accurate THEN cost ELSE 0 END) / SUM(CASE WHEN is_accurate THEN 1 ELSE 0 END) as cost_per_accurate_verification
FROM verification_metrics
GROUP BY verification_method, content_type
ORDER BY verification_method, avg_cost DESC;

-- Time-based Patterns
SELECT 
    DATE_TRUNC('hour', CAST(timestamp AS TIMESTAMP)) as hour_bucket,
    COUNT(*) as total_verifications,
    AVG(is_accurate::int) as accuracy_rate,
    AVG(response_time_ms) as avg_response_time,
    AVG(cost) as avg_cost
FROM verification_metrics
GROUP BY hour_bucket
ORDER BY hour_bucket;

-- Task Complexity Impact
WITH task_complexity AS (
    SELECT 
        task_id,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) as verification_attempts,
        AVG(confidence_score) as avg_confidence
    FROM verification_metrics
    GROUP BY task_id
)
SELECT 
    CASE 
        WHEN verification_attempts = 1 THEN 'Simple'
        WHEN verification_attempts = 2 THEN 'Moderate'
        ELSE 'Complex'
    END as complexity_level,
    COUNT(*) as task_count,
    AVG(avg_response_time) as avg_response_time,
    AVG(avg_confidence) as avg_confidence
FROM task_complexity
GROUP BY complexity_level
ORDER BY complexity_level; 