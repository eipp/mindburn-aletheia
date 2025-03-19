import { Migration } from '../MigrationManager';
export declare class AddVerificationMetrics extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
    validate(): Promise<boolean>;
    generateChecksum(): string;
}
