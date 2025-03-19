import { Migration } from '../MigrationManager';
export declare class AddWorkerSkillsGSI extends Migration {
    private readonly tableName;
    private readonly gsiName;
    up(): Promise<void>;
    down(): Promise<void>;
    validate(): Promise<boolean>;
    generateChecksum(): string;
    private waitForGSIActive;
    private updateExistingItems;
}
