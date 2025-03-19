"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddVerificationMetrics = void 0;
const crypto_1 = require("crypto");
const MigrationManager_1 = require("../MigrationManager");
class AddVerificationMetrics extends MigrationManager_1.Migration {
    async up() {
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
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async down() {
        const client = await this.context.postgres.connect();
        try {
            await client.query('BEGIN');
            // Drop in reverse order
            await client.query('DROP TRIGGER IF EXISTS refresh_worker_metrics_trigger ON verification_metrics');
            await client.query('DROP FUNCTION IF EXISTS refresh_worker_metrics()');
            await client.query('DROP MATERIALIZED VIEW IF EXISTS worker_performance_metrics');
            await client.query('DROP TABLE IF EXISTS verification_metrics CASCADE');
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async validate() {
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
        }
        catch (error) {
            this.context.logger.error('Validation failed:', error);
            return false;
        }
        finally {
            client.release();
        }
    }
    generateChecksum() {
        const content = `
      CREATE TABLE verification_metrics
      CREATE MATERIALIZED VIEW worker_performance_metrics
      CREATE FUNCTION refresh_worker_metrics
      CREATE TRIGGER refresh_worker_metrics_trigger
    `;
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
}
exports.AddVerificationMetrics = AddVerificationMetrics;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMjAyNTAyMjgyX0FkZFZlcmlmaWNhdGlvbk1ldHJpY3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIyMDI1MDIyODJfQWRkVmVyaWZpY2F0aW9uTWV0cmljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBb0M7QUFDcEMsMERBQWdEO0FBRWhELE1BQWEsc0JBQXVCLFNBQVEsNEJBQVM7SUFDbkQsS0FBSyxDQUFDLEVBQUU7UUFDTixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXJELElBQUksQ0FBQztZQUNILE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUU1QixvQ0FBb0M7WUFDcEMsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7O09BZ0JsQixDQUFDLENBQUM7WUFFSCxpQkFBaUI7WUFDakIsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDOzs7OztPQUtsQixDQUFDLENBQUM7WUFFSCxxQ0FBcUM7WUFDckMsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDOzs7Ozs7Ozs7Ozs7O09BYWxCLENBQUMsQ0FBQztZQUVILDBCQUEwQjtZQUMxQixNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUM7Ozs7Ozs7Ozs7Ozs7T0FhbEIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9CLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQy9CLE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztnQkFBUyxDQUFDO1lBQ1QsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ25CLENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRXJELElBQUksQ0FBQztZQUNILE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUU1Qix3QkFBd0I7WUFDeEIsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUNoQiwrRUFBK0UsQ0FDaEYsQ0FBQztZQUNGLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1lBQ3ZFLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO1lBQ2xGLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxtREFBbUQsQ0FBQyxDQUFDO1lBRXhFLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMvQixNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7Z0JBQVMsQ0FBQztZQUNULE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQixDQUFDO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRO1FBQ1osTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUVyRCxJQUFJLENBQUM7WUFDSCx3QkFBd0I7WUFDeEIsTUFBTSxVQUFVLEdBQUcsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDOzs7OztPQUtyQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDL0IsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBRUQsdUJBQXVCO1lBQ3ZCLE1BQU0sU0FBUyxHQUFHLE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQzs7Ozs7T0FLcEMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzlCLE9BQU8sS0FBSyxDQUFDO1lBQ2YsQ0FBQztZQUVELCtCQUErQjtZQUMvQixNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUM7Ozs7Ozs7OztPQVNsQixDQUFDLENBQUM7WUFFSCxNQUFNLFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUM7OztPQUd2QyxDQUFDLENBQUM7WUFFSCxPQUFPLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2RCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7Z0JBQVMsQ0FBQztZQUNULE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQixDQUFDO0lBQ0gsQ0FBQztJQUVELGdCQUFnQjtRQUNkLE1BQU0sT0FBTyxHQUFHOzs7OztLQUtmLENBQUM7UUFDRixPQUFPLElBQUEsbUJBQVUsRUFBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzVELENBQUM7Q0FDRjtBQWpLRCx3REFpS0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCB7IE1pZ3JhdGlvbiB9IGZyb20gJy4uL01pZ3JhdGlvbk1hbmFnZXInO1xuXG5leHBvcnQgY2xhc3MgQWRkVmVyaWZpY2F0aW9uTWV0cmljcyBleHRlbmRzIE1pZ3JhdGlvbiB7XG4gIGFzeW5jIHVwKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IHRoaXMuY29udGV4dC5wb3N0Z3Jlcy5jb25uZWN0KCk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdCRUdJTicpO1xuXG4gICAgICAvLyBDcmVhdGUgdmVyaWZpY2F0aW9uX21ldHJpY3MgdGFibGVcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeShgXG4gICAgICAgIENSRUFURSBUQUJMRSB2ZXJpZmljYXRpb25fbWV0cmljcyAoXG4gICAgICAgICAgaWQgU0VSSUFMIFBSSU1BUlkgS0VZLFxuICAgICAgICAgIHRhc2tfaWQgVkFSQ0hBUig1MCkgTk9UIE5VTEwsXG4gICAgICAgICAgd29ya2VyX2lkIFZBUkNIQVIoNTApIE5PVCBOVUxMLFxuICAgICAgICAgIHZlcmlmaWNhdGlvbl9pZCBWQVJDSEFSKDUwKSBOT1QgTlVMTCxcbiAgICAgICAgICBwcm9jZXNzaW5nX3RpbWVfbXMgSU5URUdFUiBOT1QgTlVMTCxcbiAgICAgICAgICBjb25maWRlbmNlX3Njb3JlIERFQ0lNQUwoNSw0KSBOT1QgTlVMTCxcbiAgICAgICAgICBhZ3JlZW1lbnRfcmF0ZSBERUNJTUFMKDUsNCkgTk9UIE5VTEwsXG4gICAgICAgICAgcmlza19zY29yZSBERUNJTUFMKDUsNCkgTk9UIE5VTEwsXG4gICAgICAgICAgY3JlYXRlZF9hdCBUSU1FU1RBTVAgV0lUSCBUSU1FIFpPTkUgREVGQVVMVCBDVVJSRU5UX1RJTUVTVEFNUCxcbiAgICAgICAgICBDT05TVFJBSU5UIGZrX3ZlcmlmaWNhdGlvblxuICAgICAgICAgICAgRk9SRUlHTiBLRVkodmVyaWZpY2F0aW9uX2lkKSBcbiAgICAgICAgICAgIFJFRkVSRU5DRVMgdmVyaWZpY2F0aW9ucyhpZClcbiAgICAgICAgICAgIE9OIERFTEVURSBDQVNDQURFXG4gICAgICAgICk7XG4gICAgICBgKTtcblxuICAgICAgLy8gQ3JlYXRlIGluZGV4ZXNcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeShgXG4gICAgICAgIENSRUFURSBJTkRFWCBpZHhfdmVyaWZpY2F0aW9uX21ldHJpY3NfdGFzayBPTiB2ZXJpZmljYXRpb25fbWV0cmljcyh0YXNrX2lkKTtcbiAgICAgICAgQ1JFQVRFIElOREVYIGlkeF92ZXJpZmljYXRpb25fbWV0cmljc193b3JrZXIgT04gdmVyaWZpY2F0aW9uX21ldHJpY3Mod29ya2VyX2lkKTtcbiAgICAgICAgQ1JFQVRFIElOREVYIGlkeF92ZXJpZmljYXRpb25fbWV0cmljc19jb25maWRlbmNlIE9OIHZlcmlmaWNhdGlvbl9tZXRyaWNzKGNvbmZpZGVuY2Vfc2NvcmUpO1xuICAgICAgICBDUkVBVEUgSU5ERVggaWR4X3ZlcmlmaWNhdGlvbl9tZXRyaWNzX3Jpc2sgT04gdmVyaWZpY2F0aW9uX21ldHJpY3Mocmlza19zY29yZSk7XG4gICAgICBgKTtcblxuICAgICAgLy8gQ3JlYXRlIHZpZXcgZm9yIGFnZ3JlZ2F0ZWQgbWV0cmljc1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KGBcbiAgICAgICAgQ1JFQVRFIE1BVEVSSUFMSVpFRCBWSUVXIHdvcmtlcl9wZXJmb3JtYW5jZV9tZXRyaWNzIEFTXG4gICAgICAgIFNFTEVDVCBcbiAgICAgICAgICB3b3JrZXJfaWQsXG4gICAgICAgICAgQ09VTlQoKikgYXMgdG90YWxfdmVyaWZpY2F0aW9ucyxcbiAgICAgICAgICBBVkcoY29uZmlkZW5jZV9zY29yZSkgYXMgYXZnX2NvbmZpZGVuY2UsXG4gICAgICAgICAgQVZHKHByb2Nlc3NpbmdfdGltZV9tcykgYXMgYXZnX3Byb2Nlc3NpbmdfdGltZSxcbiAgICAgICAgICBBVkcoYWdyZWVtZW50X3JhdGUpIGFzIGF2Z19hZ3JlZW1lbnRfcmF0ZSxcbiAgICAgICAgICBBVkcocmlza19zY29yZSkgYXMgYXZnX3Jpc2tfc2NvcmVcbiAgICAgICAgRlJPTSB2ZXJpZmljYXRpb25fbWV0cmljc1xuICAgICAgICBHUk9VUCBCWSB3b3JrZXJfaWQ7XG5cbiAgICAgICAgQ1JFQVRFIFVOSVFVRSBJTkRFWCBPTiB3b3JrZXJfcGVyZm9ybWFuY2VfbWV0cmljcyAod29ya2VyX2lkKTtcbiAgICAgIGApO1xuXG4gICAgICAvLyBDcmVhdGUgcmVmcmVzaCBmdW5jdGlvblxuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KGBcbiAgICAgICAgQ1JFQVRFIE9SIFJFUExBQ0UgRlVOQ1RJT04gcmVmcmVzaF93b3JrZXJfbWV0cmljcygpXG4gICAgICAgIFJFVFVSTlMgdHJpZ2dlciBBUyAkJFxuICAgICAgICBCRUdJTlxuICAgICAgICAgIFJFRlJFU0ggTUFURVJJQUxJWkVEIFZJRVcgQ09OQ1VSUkVOVExZIHdvcmtlcl9wZXJmb3JtYW5jZV9tZXRyaWNzO1xuICAgICAgICAgIFJFVFVSTiBOVUxMO1xuICAgICAgICBFTkQ7XG4gICAgICAgICQkIExBTkdVQUdFIHBscGdzcWw7XG5cbiAgICAgICAgQ1JFQVRFIFRSSUdHRVIgcmVmcmVzaF93b3JrZXJfbWV0cmljc190cmlnZ2VyXG4gICAgICAgIEFGVEVSIElOU0VSVCBPUiBVUERBVEUgT1IgREVMRVRFIE9OIHZlcmlmaWNhdGlvbl9tZXRyaWNzXG4gICAgICAgIEZPUiBFQUNIIFNUQVRFTUVOVFxuICAgICAgICBFWEVDVVRFIEZVTkNUSU9OIHJlZnJlc2hfd29ya2VyX21ldHJpY3MoKTtcbiAgICAgIGApO1xuXG4gICAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0NPTU1JVCcpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBhd2FpdCBjbGllbnQucXVlcnkoJ1JPTExCQUNLJyk7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgY2xpZW50LnJlbGVhc2UoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNsaWVudCA9IGF3YWl0IHRoaXMuY29udGV4dC5wb3N0Z3Jlcy5jb25uZWN0KCk7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdCRUdJTicpO1xuXG4gICAgICAvLyBEcm9wIGluIHJldmVyc2Ugb3JkZXJcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeShcbiAgICAgICAgJ0RST1AgVFJJR0dFUiBJRiBFWElTVFMgcmVmcmVzaF93b3JrZXJfbWV0cmljc190cmlnZ2VyIE9OIHZlcmlmaWNhdGlvbl9tZXRyaWNzJ1xuICAgICAgKTtcbiAgICAgIGF3YWl0IGNsaWVudC5xdWVyeSgnRFJPUCBGVU5DVElPTiBJRiBFWElTVFMgcmVmcmVzaF93b3JrZXJfbWV0cmljcygpJyk7XG4gICAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0RST1AgTUFURVJJQUxJWkVEIFZJRVcgSUYgRVhJU1RTIHdvcmtlcl9wZXJmb3JtYW5jZV9tZXRyaWNzJyk7XG4gICAgICBhd2FpdCBjbGllbnQucXVlcnkoJ0RST1AgVEFCTEUgSUYgRVhJU1RTIHZlcmlmaWNhdGlvbl9tZXRyaWNzIENBU0NBREUnKTtcblxuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdDT01NSVQnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgYXdhaXQgY2xpZW50LnF1ZXJ5KCdST0xMQkFDSycpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGNsaWVudC5yZWxlYXNlKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgdmFsaWRhdGUoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgY2xpZW50ID0gYXdhaXQgdGhpcy5jb250ZXh0LnBvc3RncmVzLmNvbm5lY3QoKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBDaGVjayBpZiB0YWJsZSBleGlzdHNcbiAgICAgIGNvbnN0IHRhYmxlQ2hlY2sgPSBhd2FpdCBjbGllbnQucXVlcnkoYFxuICAgICAgICBTRUxFQ1QgRVhJU1RTIChcbiAgICAgICAgICBTRUxFQ1QgRlJPTSBpbmZvcm1hdGlvbl9zY2hlbWEudGFibGVzIFxuICAgICAgICAgIFdIRVJFIHRhYmxlX25hbWUgPSAndmVyaWZpY2F0aW9uX21ldHJpY3MnXG4gICAgICAgICk7XG4gICAgICBgKTtcblxuICAgICAgaWYgKCF0YWJsZUNoZWNrLnJvd3NbMF0uZXhpc3RzKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgdmlldyBleGlzdHNcbiAgICAgIGNvbnN0IHZpZXdDaGVjayA9IGF3YWl0IGNsaWVudC5xdWVyeShgXG4gICAgICAgIFNFTEVDVCBFWElTVFMgKFxuICAgICAgICAgIFNFTEVDVCBGUk9NIHBnX21hdHZpZXdzXG4gICAgICAgICAgV0hFUkUgbWF0dmlld25hbWUgPSAnd29ya2VyX3BlcmZvcm1hbmNlX21ldHJpY3MnXG4gICAgICAgICk7XG4gICAgICBgKTtcblxuICAgICAgaWYgKCF2aWV3Q2hlY2sucm93c1swXS5leGlzdHMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBUZXN0IGluc2VydCBhbmQgdmlldyByZWZyZXNoXG4gICAgICBhd2FpdCBjbGllbnQucXVlcnkoYFxuICAgICAgICBJTlNFUlQgSU5UTyB2ZXJpZmljYXRpb25fbWV0cmljcyAoXG4gICAgICAgICAgdGFza19pZCwgd29ya2VyX2lkLCB2ZXJpZmljYXRpb25faWQsIFxuICAgICAgICAgIHByb2Nlc3NpbmdfdGltZV9tcywgY29uZmlkZW5jZV9zY29yZSwgXG4gICAgICAgICAgYWdyZWVtZW50X3JhdGUsIHJpc2tfc2NvcmVcbiAgICAgICAgKSBWQUxVRVMgKFxuICAgICAgICAgICd0ZXN0X3Rhc2snLCAndGVzdF93b3JrZXInLCAndGVzdF92ZXJpZmljYXRpb24nLFxuICAgICAgICAgIDEwMCwgMC45NSwgMC44NSwgMC4xXG4gICAgICAgICk7XG4gICAgICBgKTtcblxuICAgICAgY29uc3QgbWV0cmljc0NoZWNrID0gYXdhaXQgY2xpZW50LnF1ZXJ5KGBcbiAgICAgICAgU0VMRUNUICogRlJPTSB3b3JrZXJfcGVyZm9ybWFuY2VfbWV0cmljc1xuICAgICAgICBXSEVSRSB3b3JrZXJfaWQgPSAndGVzdF93b3JrZXInO1xuICAgICAgYCk7XG5cbiAgICAgIHJldHVybiBtZXRyaWNzQ2hlY2sucm93cy5sZW5ndGggPiAwO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKCdWYWxpZGF0aW9uIGZhaWxlZDonLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGNsaWVudC5yZWxlYXNlKCk7XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGVDaGVja3N1bSgpOiBzdHJpbmcge1xuICAgIGNvbnN0IGNvbnRlbnQgPSBgXG4gICAgICBDUkVBVEUgVEFCTEUgdmVyaWZpY2F0aW9uX21ldHJpY3NcbiAgICAgIENSRUFURSBNQVRFUklBTElaRUQgVklFVyB3b3JrZXJfcGVyZm9ybWFuY2VfbWV0cmljc1xuICAgICAgQ1JFQVRFIEZVTkNUSU9OIHJlZnJlc2hfd29ya2VyX21ldHJpY3NcbiAgICAgIENSRUFURSBUUklHR0VSIHJlZnJlc2hfd29ya2VyX21ldHJpY3NfdHJpZ2dlclxuICAgIGA7XG4gICAgcmV0dXJuIGNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShjb250ZW50KS5kaWdlc3QoJ2hleCcpO1xuICB9XG59XG4iXX0=