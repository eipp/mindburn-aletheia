"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddWorkerSkillsGSI = void 0;
const crypto_1 = require("crypto");
const MigrationManager_1 = require("../MigrationManager");
class AddWorkerSkillsGSI extends MigrationManager_1.Migration {
    constructor() {
        super(...arguments);
        this.tableName = 'Workers';
        this.gsiName = 'SkillLevelIndex';
    }
    async up() {
        // Update table with new GSI
        await this.context.dynamodb
            .updateTable({
            TableName: this.tableName,
            AttributeDefinitions: [
                { AttributeName: 'skillId', AttributeType: 'S' },
                { AttributeName: 'expertiseLevel', AttributeType: 'N' },
            ],
            GlobalSecondaryIndexUpdates: [
                {
                    Create: {
                        IndexName: this.gsiName,
                        KeySchema: [
                            { AttributeName: 'skillId', KeyType: 'HASH' },
                            { AttributeName: 'expertiseLevel', KeyType: 'RANGE' },
                        ],
                        Projection: { ProjectionType: 'ALL' },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5,
                        },
                    },
                },
            ],
        })
            .promise();
        // Wait for GSI to become active
        await this.waitForGSIActive();
        // Update existing items with new attributes
        await this.updateExistingItems();
    }
    async down() {
        await this.context.dynamodb
            .updateTable({
            TableName: this.tableName,
            GlobalSecondaryIndexUpdates: [
                {
                    Delete: {
                        IndexName: this.gsiName,
                    },
                },
            ],
        })
            .promise();
    }
    async validate() {
        try {
            // Check if GSI exists and is active
            const table = await this.context.dynamodb
                .describeTable({
                TableName: this.tableName,
            })
                .promise();
            const gsi = table.Table.GlobalSecondaryIndexes?.find(index => index.IndexName === this.gsiName);
            if (!gsi || gsi.IndexStatus !== 'ACTIVE') {
                return false;
            }
            // Verify sample queries work
            const testQuery = await this.context.dynamodb
                .query({
                TableName: this.tableName,
                IndexName: this.gsiName,
                KeyConditionExpression: 'skillId = :skillId',
                ExpressionAttributeValues: {
                    ':skillId': 'TEST_SKILL',
                },
            })
                .promise();
            return true;
        }
        catch (error) {
            this.context.logger.error('Validation failed:', error);
            return false;
        }
    }
    generateChecksum() {
        const content = `
      ${this.tableName}
      ${this.gsiName}
      skillId:S
      expertiseLevel:N
      ALL
    `;
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    async waitForGSIActive() {
        let isActive = false;
        while (!isActive) {
            const table = await this.context.dynamodb
                .describeTable({
                TableName: this.tableName,
            })
                .promise();
            const gsi = table.Table.GlobalSecondaryIndexes?.find(index => index.IndexName === this.gsiName);
            if (gsi?.IndexStatus === 'ACTIVE') {
                isActive = true;
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    async updateExistingItems() {
        let lastEvaluatedKey;
        do {
            const scanResult = await this.context.dynamodb
                .scan({
                TableName: this.tableName,
                ExclusiveStartKey: lastEvaluatedKey,
            })
                .promise();
            const updates = scanResult.Items.map(item => ({
                PutRequest: {
                    Item: {
                        ...item,
                        skillId: item.primarySkill || 'UNKNOWN',
                        expertiseLevel: item.yearsOfExperience || 0,
                    },
                },
            }));
            if (updates.length > 0) {
                await this.context.dynamodb
                    .batchWrite({
                    RequestItems: {
                        [this.tableName]: updates,
                    },
                })
                    .promise();
            }
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);
    }
}
exports.AddWorkerSkillsGSI = AddWorkerSkillsGSI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMjAyNTAyMjgxX0FkZFdvcmtlclNraWxsc0dTSS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIjIwMjUwMjI4MV9BZGRXb3JrZXJTa2lsbHNHU0kudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW9DO0FBQ3BDLDBEQUFnRDtBQUVoRCxNQUFhLGtCQUFtQixTQUFRLDRCQUFTO0lBQWpEOztRQUNtQixjQUFTLEdBQUcsU0FBUyxDQUFDO1FBQ3RCLFlBQU8sR0FBRyxpQkFBaUIsQ0FBQztJQXlKL0MsQ0FBQztJQXZKQyxLQUFLLENBQUMsRUFBRTtRQUNOLDRCQUE0QjtRQUM1QixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUTthQUN4QixXQUFXLENBQUM7WUFDWCxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsb0JBQW9CLEVBQUU7Z0JBQ3BCLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxhQUFhLEVBQUUsR0FBRyxFQUFFO2dCQUNoRCxFQUFFLGFBQWEsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsR0FBRyxFQUFFO2FBQ3hEO1lBQ0QsMkJBQTJCLEVBQUU7Z0JBQzNCO29CQUNFLE1BQU0sRUFBRTt3QkFDTixTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87d0JBQ3ZCLFNBQVMsRUFBRTs0QkFDVCxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRTs0QkFDN0MsRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRTt5QkFDdEQ7d0JBQ0QsVUFBVSxFQUFFLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRTt3QkFDckMscUJBQXFCLEVBQUU7NEJBQ3JCLGlCQUFpQixFQUFFLENBQUM7NEJBQ3BCLGtCQUFrQixFQUFFLENBQUM7eUJBQ3RCO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDO2FBQ0QsT0FBTyxFQUFFLENBQUM7UUFFYixnQ0FBZ0M7UUFDaEMsTUFBTSxJ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IHsgTWlncmF0aW9uIH0gZnJvbSAnLi4vTWlncmF0aW9uTWFuYWdlcic7XG5cbmV4cG9ydCBjbGFzcyBBZGRXb3JrZXJTa2lsbHNHU0kgZXh0ZW5kcyBNaWdyYXRpb24ge1xuICBwcml2YXRlIHJlYWRvbmx5IHRhYmxlTmFtZSA9ICdXb3JrZXJzJztcbiAgcHJpdmF0ZSByZWFkb25seSBnc2lOYW1lID0gJ1NraWxsTGV2ZWxJbmRleCc7XG5cbiAgYXN5bmMgdXAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gVXBkYXRlIHRhYmxlIHdpdGggbmV3IEdTSVxuICAgIGF3YWl0IHRoaXMuY29udGV4dC5keW5hbW9kYlxuICAgICAgLnVwZGF0ZVRhYmxlKHtcbiAgICAgICAgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSxcbiAgICAgICAgQXR0cmlidXRlRGVmaW5pdGlvbnM6IFtcbiAgICAgICAgICB7IEF0dHJpYnV0ZU5hbWU6ICdza2lsbElkJywgQXR0cmlidXRlVHlwZTogJ1MnIH0sXG4gICAgICAgICAgeyBBdHRyaWJ1dGVOYW1lOiAnZXhwZXJ0aXNlTGV2ZWwnLCBBdHRyaWJ1dGVUeXBlOiAnTicgfSxcbiAgICAgICAgXSxcbiAgICAgICAgR2xvYmFsU2Vjb25kYXJ5SW5kZXhVcGRhdGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgQ3JlYXRlOiB7XG4gICAgICAgICAgICAgIEluZGV4TmFtZTogdGhpcy5nc2lOYW1lLFxuICAgICAgICAgICAgICBLZXlTY2hlbWE6IFtcbiAgICAgICAgICAgICAgICB7IEF0dHJpYnV0ZU5hbWU6ICdza2lsbElkJywgS2V5VHlwZTogJ0hBU0gnIH0sXG4gICAgICAgICAgICAgICAgeyBBdHRyaWJ1dGVOYW1lOiAnZXhwZXJ0aXNlTGV2ZWwnLCBLZXlUeXBlOiAnUkFOR0UnIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIFByb2plY3Rpb246IHsgUHJvamVjdGlvblR5cGU6ICdBTEwnIH0sXG4gICAgICAgICAgICAgIFByb3Zpc2lvbmVkVGhyb3VnaHB1dDoge1xuICAgICAgICAgICAgICAgIFJlYWRDYXBhY2l0eVVuaXRzOiA1LFxuICAgICAgICAgICAgICAgIFdyaXRlQ2FwYWNpdHlVbml0czogNSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgICAucHJvbWlzZSgpO1xuXG4gICAgLy8gV2FpdCBmb3IgR1NJIHRvIGJlY29tZSBhY3RpdmVcbiAgICBhd2FpdCB0aGlzLndhaXRGb3JHU0lBY3RpdmUoKTtcblxuICAgIC8vIFVwZGF0ZSBleGlzdGluZyBpdGVtcyB3aXRoIG5ldyBhdHRyaWJ1dGVzXG4gICAgYXdhaXQgdGhpcy51cGRhdGVFeGlzdGluZ0l0ZW1zKCk7XG4gIH1cblxuICBhc3luYyBkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuY29udGV4dC5keW5hbW9kYlxuICAgICAgLnVwZGF0ZVRhYmxlKHtcbiAgICAgICAgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSxcbiAgICAgICAgR2xvYmFsU2Vjb25kYXJ5SW5kZXhVcGRhdGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgRGVsZXRlOiB7XG4gICAgICAgICAgICAgIEluZGV4TmFtZTogdGhpcy5nc2lOYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICAgIC5wcm9taXNlKCk7XG4gIH1cblxuICBhc3luYyB2YWxpZGF0ZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgLy8gQ2hlY2sgaWYgR1NJIGV4aXN0cyBhbmQgaXMgYWN0aXZlXG4gICAgICBjb25zdCB0YWJsZSA9IGF3YWl0IHRoaXMuY29udGV4dC5keW5hbW9kYlxuICAgICAgICAuZGVzY3JpYmVUYWJsZSh7XG4gICAgICAgICAgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSxcbiAgICAgICAgfSlcbiAgICAgICAgLnByb21pc2UoKTtcblxuICAgICAgY29uc3QgZ3NpID0gdGFibGUuVGFibGUuR2xvYmFsU2Vjb25kYXJ5SW5kZXhlcz8uZmluZChcbiAgICAgICAgaW5kZXggPT4gaW5kZXguSW5kZXhOYW1lID09PSB0aGlzLmdzaU5hbWVcbiAgICAgICk7XG5cbiAgICAgIGlmICghZ3NpIHx8IGdzaS5JbmRleFN0YXR1cyAhPT0gJ0FDVElWRScpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBWZXJpZnkgc2FtcGxlIHF1ZXJpZXMgd29ya1xuICAgICAgY29uc3QgdGVzdFF1ZXJ5ID0gYXdhaXQgdGhpcy5jb250ZXh0LmR5bmFtb2RiXG4gICAgICAgIC5xdWVyeSh7XG4gICAgICAgICAgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSxcbiAgICAgICAgICBJbmRleE5hbWU6IHRoaXMuZ3NpTmFtZSxcbiAgICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAnc2tpbGxJZCA9IDpza2lsbElkJyxcbiAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAnOnNraWxsSWQnOiAnVEVTVF9TS0lMTCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgICAgLnByb21pc2UoKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IoJ1ZhbGlkYXRpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBnZW5lcmF0ZUNoZWNrc3VtKCk6IHN0cmluZyB7XG4gICAgY29uc3QgY29udGVudCA9IGBcbiAgICAgICR7dGhpcy50YWJsZU5hbWV9XG4gICAgICAke3RoaXMuZ3NpTmFtZX1cbiAgICAgIHNraWxsSWQ6U1xuICAgICAgZXhwZXJ0aXNlTGV2ZWw6TlxuICAgICAgQUxMXG4gICAgYDtcbiAgICByZXR1cm4gY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGNvbnRlbnQpLmRpZ2VzdCgnaGV4Jyk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHdhaXRGb3JHU0lBY3RpdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IGlzQWN0aXZlID0gZmFsc2U7XG4gICAgd2hpbGUgKCFpc0FjdGl2ZSkge1xuICAgICAgY29uc3QgdGFibGUgPSBhd2FpdCB0aGlzLmNvbnRleHQuZHluYW1vZGJcbiAgICAgICAgLmRlc2NyaWJlVGFibGUoe1xuICAgICAgICAgIFRhYmxlTmFtZTogdGhpcy50YWJsZU5hbWUsXG4gICAgICAgIH0pXG4gICAgICAgIC5wcm9taXNlKCk7XG5cbiAgICAgIGNvbnN0IGdzaSA9IHRhYmxlLlRhYmxlLkdsb2JhbFNlY29uZGFyeUluZGV4ZXM/LmZpbmQoXG4gICAgICAgIGluZGV4ID0+IGluZGV4LkluZGV4TmFtZSA9PT0gdGhpcy5nc2lOYW1lXG4gICAgICApO1xuXG4gICAgICBpZiAoZ3NpPy5JbmRleFN0YXR1cyA9PT0gJ0FDVElWRScpIHtcbiAgICAgICAgaXNBY3RpdmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMDApKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHVwZGF0ZUV4aXN0aW5nSXRlbXMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IGxhc3RFdmFsdWF0ZWRLZXk7XG4gICAgZG8ge1xuICAgICAgY29uc3Qgc2NhblJlc3VsdCA9IGF3YWl0IHRoaXMuY29udGV4dC5keW5hbW9kYlxuICAgICAgICAuc2Nhbih7XG4gICAgICAgICAgVGFibGVOYW1lOiB0aGlzLnRhYmxlTmFtZSxcbiAgICAgICAgICBFeGNsdXNpdmVTdGFydEtleTogbGFzdEV2YWx1YXRlZEtleSxcbiAgICAgICAgfSlcbiAgICAgICAgLnByb21pc2UoKTtcblxuICAgICAgY29uc3QgdXBkYXRlcyA9IHNjYW5SZXN1bHQuSXRlbXMubWFwKGl0ZW0gPT4gKHtcbiAgICAgICAgUHV0UmVxdWVzdDoge1xuICAgICAgICAgIEl0ZW06IHtcbiAgICAgICAgICAgIC4uLml0ZW0sXG4gICAgICAgICAgICBza2lsbElkOiBpdGVtLnByaW1hcnlTa2lsbCB8fCAnVU5LTk9XTicsXG4gICAgICAgICAgICBleHBlcnRpc2VMZXZlbDogaXRlbS55ZWFyc09mRXhwZXJpZW5jZSB8fCAwLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSk7XG5cbiAgICAgIGlmICh1cGRhdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYXdhaXQgdGhpcy5jb250ZXh0LmR5bmFtb2RiXG4gICAgICAgICAgLmJhdGNoV3JpdGUoe1xuICAgICAgICAgICAgUmVxdWVzdEl0ZW1zOiB7XG4gICAgICAgICAgICAgIFt0aGlzLnRhYmxlTmFtZV06IHVwZGF0ZXMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnByb21pc2UoKTtcbiAgICAgIH1cblxuICAgICAgbGFzdEV2YWx1YXRlZEtleSA9IHNjYW5SZXN1bHQuTGFzdEV2YWx1YXRlZEtleTtcbiAgICB9IHdoaWxlIChsYXN0RXZhbHVhdGVkS2V5KTtcbiAgfVxufVxuIl19