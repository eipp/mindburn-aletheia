import { createHash } from 'crypto';
import { Migration } from '../MigrationManager';

export class AddVerificationMetrics extends Migration {
  async up(): Promise<void> {
    const client = await this.context.postgres.connect();

    try {
      await client.query('BEGIN');

      // Create verification_metrics table
      await client.query(`
        CREATE TABLE verification_metrics (
          id SERIAL PRIMARY KEY,
          task_id VARCHAR(50) NOT NULL,
          worker_id VARCHAR(50) NOT NULL,
          verification_id VARCHAR(50) NOT NULL,
          processing_time_ms INTEGER NOT NULL,
          confidence_score DECIMAL(5,4) NOT NULL,
          agreement_rate DECIMAL(5,4) NOT NULL,
          risk_score DECIMAL(5,4) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_verification
            FOREIGN KEY(verification_id) 
            REFERENCES verifications(id)
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX idx_verification_metrics_task ON verification_metrics(task_id);
        CREATE INDEX idx_verification_metrics_worker ON verification_metrics(worker_id);
        CREATE INDEX idx_verification_metrics_confidence ON verification_metrics(confidence_score);
        CREATE INDEX idx_verification_metrics_risk ON verification_metrics(risk_score);
      `);

      // Create view for aggregated metrics
      await client.query(`
        CREATE MATERIALIZED VIEW worker_performance_metrics AS
        SELECT 
          worker_id,
          COUNT(*) as total_verifications,
          AVG(confidence_score) as avg_confidence,
          AVG(processing_time_ms) as avg_processing_time,
          AVG(agreement_rate) as avg_agreement_rate,
          AVG(risk_score) as avg_risk_score
        FROM verification_metrics
        GROUP BY worker_id;

        CREATE UNIQUE INDEX ON worker_performance_metrics (worker_id);
      `);

      // Create refresh function
      await client.query(`
        CREATE OR REPLACE FUNCTION refresh_worker_metrics()
        RETURNS trigger AS $$
        BEGIN
          REFRESH MATERIALIZED VIEW CONCURRENTLY worker_performance_metrics;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER refresh_worker_metrics_trigger
        AFTER INSERT OR UPDATE OR DELETE ON verification_metrics
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_worker_metrics();
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async down(): Promise<void> {
    const client = await this.context.postgres.connect();

    try {
      await client.query('BEGIN');

      // Drop in reverse order
      await client.query(
        'DROP TRIGGER IF EXISTS refresh_worker_metrics_trigger ON verification_metrics'
      );
      await client.query('DROP FUNCTION IF EXISTS refresh_worker_metrics()');
      await client.query('DROP MATERIALIZED VIEW IF EXISTS worker_performance_metrics');
      await client.query('DROP TABLE IF EXISTS verification_metrics CASCADE');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async validate(): Promise<boolean> {
    const client = await this.context.postgres.connect();

    try {
      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'verification_metrics'
        );
      `);

      if (!tableCheck.rows[0].exists) {
        return false;
      }

      // Check if view exists
      const viewCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_matviews
          WHERE matviewname = 'worker_performance_metrics'
        );
      `);

      if (!viewCheck.rows[0].exists) {
        return false;
      }

      // Test insert and view refresh
      await client.query(`
        INSERT INTO verification_metrics (
          task_id, worker_id, verification_id, 
          processing_time_ms, confidence_score, 
          agreement_rate, risk_score
        ) VALUES (
          'test_task', 'test_worker', 'test_verification',
          100, 0.95, 0.85, 0.1
        );
      `);

      const metricsCheck = await client.query(`
        SELECT * FROM worker_performance_metrics
        WHERE worker_id = 'test_worker';
      `);

      return metricsCheck.rows.length > 0;
    } catch (error) {
      this.context.logger.error('Validation failed:', error);
      return false;
    } finally {
      client.release();
    }
  }

  generateChecksum(): string {
    const content = `
      CREATE TABLE verification_metrics
      CREATE MATERIALIZED VIEW worker_performance_metrics
      CREATE FUNCTION refresh_worker_metrics
      CREATE TRIGGER refresh_worker_metrics_trigger
    `;
    return createHash('sha256').update(content).digest('hex');
  }
}
