"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const aws_sdk_1 = require("aws-sdk");
const path = require("path");
const fs = require("fs");
const MigrationManager_1 = require("../../../migrations/MigrationManager");
const Logger_1 = require("../../../utils/Logger");
// Configure AWS SDK
const dynamodb = new aws_sdk_1.DynamoDB.DocumentClient();
const s3 = new aws_sdk_1.S3();
const cloudwatch = new aws_sdk_1.CloudWatch();
// Set up logger
const logger = new Logger_1.Logger({
    level: process.env.LOG_LEVEL || 'info',
    service: 'migration-handler',
});
// Create migration context
const migrationContext = {
    dynamodb,
    s3,
    cloudwatch,
    logger,
    environment: process.env.STAGE || 'dev',
    postgres: null, // We're only dealing with DynamoDB migrations here
};
// Initialize migration manager
const migrationManager = new MigrationManager_1.MigrationManager(migrationContext);
/**
 * Load migrations from the migration directory
 */
async function loadMigrations() {
    const migrationsDir = path.join(__dirname, '../../../migrations/dynamodb');
    try {
        const files = fs.readdirSync(migrationsDir);
        const migrationFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js'));
        const migrations = [];
        for (const file of migrationFiles) {
            try {
                const filePath = path.join(migrationsDir, file);
                // Import the migration class
                // For deployment, we'll use the compiled JS files
                const migrationModule = require(filePath);
                // Get the class name (assumed to be the only export or the default export)
                const className = Object.keys(migrationModule)[0];
                const MigrationClass = migrationModule[className];
                if (MigrationClass && typeof MigrationClass === 'function') {
                    // Extract version from filename (e.g., 202502281_AddWorkerSkillsGSI.ts -> 202502281)
                    const version = file.split('_')[0];
                    // Create migration instance
                    const migration = new MigrationClass(migrationContext, version, className);
                    migrations.push(migration);
                }
            }
            catch (error) {
                logger.error(`Failed to load migration from file ${file}:`, error);
            }
        }
        // Sort migrations by version
        return migrations.sort((a, b) => a.version.localeCompare(b.version));
    }
    catch (error) {
        logger.error('Failed to load migrations:', error);
        return [];
    }
}
/**
 * Lambda handler for running migrations
 */
async function handler(event) {
    try {
        logger.info('Starting migrations', { event });
        // Initialize migration infrastructure
        await migrationManager.initialize();
        // Load migrations
        const migrations = await loadMigrations();
        logger.info(`Loaded ${migrations.length} migrations`);
        // Determine which migrations to run based on the event
        let migrationsToRun = migrations;
        if (event.version) {
            // Run a specific migration
            migrationsToRun = migrations.filter(m => m.version === event.version);
            if (migrationsToRun.length === 0) {
                throw new Error(`Migration with version ${event.version} not found`);
            }
        }
        else if (event.up) {
            // Run all pending migrations
            // Migrations that are already applied will be skipped by the migration manager
        }
        else if (event.down) {
            // Run a rollback
            const lastMigration = migrations[migrations.length - 1];
            migrationsToRun = [lastMigration];
        }
        // Run the migrations
        for (const migration of migrationsToRun) {
            logger.info(`Applying migration ${migration.version}: ${migration.constructor.name}`);
            await migrationManager.applyMigration(migration);
        }
        logger.info('Migrations completed successfully');
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Migrations completed successfully',
                appliedMigrations: migrationsToRun.map(m => ({
                    version: m.version,
                    name: m.constructor.name,
                })),
            }),
        };
    }
    catch (error) {
        logger.error('Migration failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Migration failed',
                error: error.message,
            }),
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQThFQSwwQkEyREM7QUF6SUQscUNBQW1EO0FBQ25ELDZCQUE2QjtBQUM3Qix5QkFBeUI7QUFDekIsMkVBQW1GO0FBQ25GLGtEQUErQztBQUUvQyxvQkFBb0I7QUFDcEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxrQkFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQy9DLE1BQU0sRUFBRSxHQUFHLElBQUksWUFBRSxFQUFFLENBQUM7QUFDcEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxvQkFBVSxFQUFFLENBQUM7QUFFcEMsZ0JBQWdCO0FBQ2hCLE1BQU0sTUFBTSxHQUFHLElBQUksZUFBTSxDQUFDO0lBQ3hCLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsSUFBSSxNQUFNO0lBQ3RDLE9BQU8sRUFBRSxtQkFBbUI7Q0FDN0IsQ0FBQyxDQUFDO0FBRUgsMkJBQTJCO0FBQzNCLE1BQU0sZ0JBQWdCLEdBQUc7SUFDdkIsUUFBUTtJQUNSLEVBQUU7SUFDRixVQUFVO0lBQ1YsTUFBTTtJQUNOLFdBQVcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxLQUFLO0lBQ3ZDLFFBQVEsRUFBRSxJQUFJLEVBQUUsbURBQW1EO0NBQ3BFLENBQUM7QUFFRiwrQkFBK0I7QUFDL0IsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLG1DQUFnQixDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFFaEU7O0dBRUc7QUFDSCxLQUFLLFVBQVUsY0FBYztJQUMzQixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO0lBRTNFLElBQUksQ0FBQztRQUNILE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDNUMsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFD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QUNyQixDQUFDO1NBQ0gsQ0FBQztJQUNKLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRHluYW1vREIsIFMzLCBDbG91ZFdhdGNoIH0gZnJvbSAnYXdzLXNkayc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgTWlncmF0aW9uTWFuYWdlciwgTWlncmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vbWlncmF0aW9ucy9NaWdyYXRpb25NYW5hZ2VyJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uLy4uLy4uL3V0aWxzL0xvZ2dlcic7XG5cbi8vIENvbmZpZ3VyZSBBV1MgU0RLXG5jb25zdCBkeW5hbW9kYiA9IG5ldyBEeW5hbW9EQi5Eb2N1bWVudENsaWVudCgpO1xuY29uc3QgczMgPSBuZXcgUzMoKTtcbmNvbnN0IGNsb3Vkd2F0Y2ggPSBuZXcgQ2xvdWRXYXRjaCgpO1xuXG4vLyBTZXQgdXAgbG9nZ2VyXG5jb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKHtcbiAgbGV2ZWw6IHByb2Nlc3MuZW52LkxPR19MRVZFTCB8fCAnaW5mbycsXG4gIHNlcnZpY2U6ICdtaWdyYXRpb24taGFuZGxlcicsXG59KTtcblxuLy8gQ3JlYXRlIG1pZ3JhdGlvbiBjb250ZXh0XG5jb25zdCBtaWdyYXRpb25Db250ZXh0ID0ge1xuICBkeW5hbW9kYixcbiAgczMsXG4gIGNsb3Vkd2F0Y2gsXG4gIGxvZ2dlcixcbiAgZW52aXJvbm1lbnQ6IHByb2Nlc3MuZW52LlNUQUdFIHx8ICdkZXYnLFxuICBwb3N0Z3JlczogbnVsbCwgLy8gV2UncmUgb25seSBkZWFsaW5nIHdpdGggRHluYW1vREIgbWlncmF0aW9ucyBoZXJlXG59O1xuXG4vLyBJbml0aWFsaXplIG1pZ3JhdGlvbiBtYW5hZ2VyXG5jb25zdCBtaWdyYXRpb25NYW5hZ2VyID0gbmV3IE1pZ3JhdGlvbk1hbmFnZXIobWlncmF0aW9uQ29udGV4dCk7XG5cbi8qKlxuICogTG9hZCBtaWdyYXRpb25zIGZyb20gdGhlIG1pZ3JhdGlvbiBkaXJlY3RvcnlcbiAqL1xuYXN5bmMgZnVuY3Rpb24gbG9hZE1pZ3JhdGlvbnMoKTogUHJvbWlzZTxNaWdyYXRpb25bXT4ge1xuICBjb25zdCBtaWdyYXRpb25zRGlyID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL21pZ3JhdGlvbnMvZHluYW1vZGInKTtcbiAgXG4gIHRyeSB7XG4gICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhtaWdyYXRpb25zRGlyKTtcbiAgICBjb25zdCBtaWdyYXRpb25GaWxlcyA9IGZpbGVzLmZpbHRlcihmaWxlID0+IGZpbGUuZW5kc1dpdGgoJy50cycpIHx8IGZpbGUuZW5kc1dpdGgoJy5qcycpKTtcbiAgICBcbiAgICBjb25zdCBtaWdyYXRpb25zOiBNaWdyYXRpb25bXSA9IFtdO1xuICAgIFxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBtaWdyYXRpb25GaWxlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4obWlncmF0aW9uc0RpciwgZmlsZSk7XG4gICAgICAgIFxuICAgICAgICAvLyBJbXBvcnQgdGhlIG1pZ3JhdGlvbiBjbGFzc1xuICAgICAgICAvLyBGb3IgZGVwbG95bWVudCwgd2UnbGwgdXNlIHRoZSBjb21waWxlZCBKUyBmaWxlc1xuICAgICAgICBjb25zdCBtaWdyYXRpb25Nb2R1bGUgPSByZXF1aXJlKGZpbGVQYXRoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIEdldCB0aGUgY2xhc3MgbmFtZSAoYXNzdW1lZCB0byBiZSB0aGUgb25seSBleHBvcnQgb3IgdGhlIGRlZmF1bHQgZXhwb3J0KVxuICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBPYmplY3Qua2V5cyhtaWdyYXRpb25Nb2R1bGUpWzBdO1xuICAgICAgICBjb25zdCBNaWdyYXRpb25DbGFzcyA9IG1pZ3JhdGlvbk1vZHVsZVtjbGFzc05hbWVdO1xuICAgICAgICBcbiAgICAgICAgaWYgKE1pZ3JhdGlvbkNsYXNzICYmIHR5cGVvZiBNaWdyYXRpb25DbGFzcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIC8vIEV4dHJhY3QgdmVyc2lvbiBmcm9tIGZpbGVuYW1lIChlLmcuLCAyMDI1MDIyODFfQWRkV29ya2VyU2tpbGxzR1NJLnRzIC0+IDIwMjUwMjI4MSlcbiAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gZmlsZS5zcGxpdCgnXycpWzBdO1xuICAgICAgICAgIFxuICAgICAgICAgIC8vIENyZWF0ZSBtaWdyYXRpb24gaW5zdGFuY2VcbiAgICAgICAgICBjb25zdCBtaWdyYXRpb24gPSBuZXcgTWlncmF0aW9uQ2xhc3MobWlncmF0aW9uQ29udGV4dCwgdmVyc2lvbiwgY2xhc3NOYW1lKTtcbiAgICAgICAgICBtaWdyYXRpb25zLnB1c2gobWlncmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGBGYWlsZWQgdG8gbG9hZCBtaWdyYXRpb24gZnJvbSBmaWxlICR7ZmlsZX06YCwgZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBTb3J0IG1pZ3JhdGlvbnMgYnkgdmVyc2lvblxuICAgIHJldHVybiBtaWdyYXRpb25zLnNvcnQoKGEsIGIpID0+IGEudmVyc2lvbi5sb2NhbGVDb21wYXJlKGIudmVyc2lvbikpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIGxvYWQgbWlncmF0aW9uczonLCBlcnJvcik7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbi8qKlxuICogTGFtYmRhIGhhbmRsZXIgZm9yIHJ1bm5pbmcgbWlncmF0aW9uc1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihldmVudDogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgdHJ5IHtcbiAgICBsb2dnZXIuaW5mbygnU3RhcnRpbmcgbWlncmF0aW9ucycsIHsgZXZlbnQgfSk7XG4gICAgXG4gICAgLy8gSW5pdGlhbGl6ZSBtaWdyYXRpb24gaW5mcmFzdHJ1Y3R1cmVcbiAgICBhd2FpdCBtaWdyYXRpb25NYW5hZ2VyLmluaXRpYWxpemUoKTtcbiAgICBcbiAgICAvLyBMb2FkIG1pZ3JhdGlvbnNcbiAgICBjb25zdCBtaWdyYXRpb25zID0gYXdhaXQgbG9hZE1pZ3JhdGlvbnMoKTtcbiAgICBsb2dnZXIuaW5mbyhgTG9hZGVkICR7bWlncmF0aW9ucy5sZW5ndGh9IG1pZ3JhdGlvbnNgKTtcbiAgICBcbiAgICAvLyBEZXRlcm1pbmUgd2hpY2ggbWlncmF0aW9ucyB0byBydW4gYmFzZWQgb24gdGhlIGV2ZW50XG4gICAgbGV0IG1pZ3JhdGlvbnNUb1J1biA9IG1pZ3JhdGlvbnM7XG4gICAgXG4gICAgaWYgKGV2ZW50LnZlcnNpb24pIHtcbiAgICAgIC8vIFJ1biBhIHNwZWNpZmljIG1pZ3JhdGlvblxuICAgICAgbWlncmF0aW9uc1RvUnVuID0gbWlncmF0aW9ucy5maWx0ZXIobSA9PiBtLnZlcnNpb24gPT09IGV2ZW50LnZlcnNpb24pO1xuICAgICAgXG4gICAgICBpZiAobWlncmF0aW9uc1RvUnVuLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE1pZ3JhdGlvbiB3aXRoIHZlcnNpb24gJHtldmVudC52ZXJzaW9ufSBub3QgZm91bmRgKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV2ZW50LnVwKSB7XG4gICAgICAvLyBSdW4gYWxsIHBlbmRpbmcgbWlncmF0aW9uc1xuICAgICAgLy8gTWlncmF0aW9ucyB0aGF0IGFyZSBhbHJlYWR5IGFwcGxpZWQgd2lsbCBiZSBza2lwcGVkIGJ5IHRoZSBtaWdyYXRpb24gbWFuYWdlclxuICAgIH0gZWxzZSBpZiAoZXZlbnQuZG93bikge1xuICAgICAgLy8gUnVuIGEgcm9sbGJhY2tcbiAgICAgIGNvbnN0IGxhc3RNaWdyYXRpb24gPSBtaWdyYXRpb25zW21pZ3JhdGlvbnMubGVuZ3RoIC0gMV07XG4gICAgICBtaWdyYXRpb25zVG9SdW4gPSBbbGFzdE1pZ3JhdGlvbl07XG4gICAgfVxuICAgIFxuICAgIC8vIFJ1biB0aGUgbWlncmF0aW9uc1xuICAgIGZvciAoY29uc3QgbWlncmF0aW9uIG9mIG1pZ3JhdGlvbnNUb1J1bikge1xuICAgICAgbG9nZ2VyLmluZm8oYEFwcGx5aW5nIG1pZ3JhdGlvbiAke21pZ3JhdGlvbi52ZXJzaW9ufTogJHttaWdyYXRpb24uY29uc3RydWN0b3IubmFtZX1gKTtcbiAgICAgIGF3YWl0IG1pZ3JhdGlvbk1hbmFnZXIuYXBwbHlNaWdyYXRpb24obWlncmF0aW9uKTtcbiAgICB9XG4gICAgXG4gICAgbG9nZ2VyLmluZm8oJ01pZ3JhdGlvbnMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIG1lc3NhZ2U6ICdNaWdyYXRpb25zIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICBhcHBsaWVkTWlncmF0aW9uczogbWlncmF0aW9uc1RvUnVuLm1hcChtID0+ICh7XG4gICAgICAgICAgdmVyc2lvbjogbS52ZXJzaW9uLFxuICAgICAgICAgIG5hbWU6IG0uY29uc3RydWN0b3IubmFtZSxcbiAgICAgICAgfSkpLFxuICAgICAgfSksXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIuZXJyb3IoJ01pZ3JhdGlvbiBmYWlsZWQ6JywgZXJyb3IpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIG1lc3NhZ2U6ICdNaWdyYXRpb24gZmFpbGVkJyxcbiAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICB9KSxcbiAgICB9O1xuICB9XG59ICJdfQ==