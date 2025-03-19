#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migration_handler_1 = require("../packages/infrastructure-tools/src/migration-handler");
const yargs = require("yargs");
async function main() {
    // Parse command line arguments
    const argv = yargs
        .option('stage', {
        alias: 's',
        description: 'Deployment stage',
        type: 'string',
        default: process.env.STAGE || 'dev',
    })
        .option('version', {
        alias: 'v',
        description: 'Run a specific migration version',
        type: 'string',
    })
        .option('up', {
        description: 'Run all pending migrations',
        type: 'boolean',
        default: false,
    })
        .option('down', {
        description: 'Rollback the last migration',
        type: 'boolean',
        default: false,
    })
        .help()
        .alias('help', 'h')
        .argv;
    // Check for incompatible options
    if ((argv.version && argv.up) ||
        (argv.version && argv.down) ||
        (argv.up && argv.down)) {
        console.error('Error: Specify only one of --version, --up, or --down');
        process.exit(1);
    }
    // Default to --up if no option provided
    const event = {
        version: argv.version,
        up: argv.version ? false : argv.up || (!argv.down && !argv.version),
        down: argv.down,
        stage: argv.stage,
    };
    // Set environment variable for the migration handler
    process.env.STAGE = argv.stage;
    console.log(`Running migrations for stage: ${argv.stage}`);
    console.log('Migration options:', {
        version: event.version || 'all pending',
        direction: event.down ? 'down' : 'up',
    });
    try {
        const result = await (0, migration_handler_1.handler)(event);
        if (result.statusCode === 200) {
            console.log('Migrations completed successfully');
            const body = JSON.parse(result.body);
            if (body.appliedMigrations?.length > 0) {
                console.log('\nApplied migrations:');
                body.appliedMigrations.forEach((migration) => {
                    console.log(`- ${migration.version}: ${migration.name}`);
                });
            }
            else {
                console.log('No migrations applied');
            }
        }
        else {
            console.error('Migration failed:');
            console.error(JSON.parse(result.body).error);
            process.exit(1);
        }
    }
    catch (error) {
        console.error('Error executing migrations:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuLW1pZ3JhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJydW4tbWlncmF0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSw4RkFBaUY7QUFDakYsK0JBQStCO0FBRS9CLEtBQUssVUFBVSxJQUFJO0lBQ2pCLCtCQUErQjtJQUMvQixNQUFNLElBQUksR0FBRyxLQUFLO1NBQ2YsTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUNmLEtBQUssRUFBRSxHQUFHO1FBQ1YsV0FBVyxFQUFFLGtCQUFrQjtRQUMvQixJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxLQUFLO0tBQ3BDLENBQUM7U0FDRCxNQUFNLENBQUMsU0FBUyxFQUFFO1FBQ2pCLEtBQUssRUFBRSxHQUFHO1FBQ1YsV0FBVyxFQUFFLGtDQUFrQztRQUMvQyxJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUM7U0FDRCxNQUFNLENBQUMsSUFBSSxFQUFFO1FBQ1osV0FBVyxFQUFFLDRCQUE0QjtRQUN6QyxJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxLQUFLO0tBQ2YsQ0FBQztTQUNELE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDZCxXQUFXLEVBQUUsNkJBQTZCO1FBQzFDLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7S0FDZixDQUFDO1NBQ0QsSUFBSSxFQUFFO1NBQ04sS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUM7U0FDbEIsSUFBSSxDQUFDO0lBRVIsaUNBQWlDO0lBQ2pDLElBQ0UsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDekIsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDM0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsRUFDdEIsQ0FBQztRQUNELE9BQU8sQ0FBQyxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztRQUN2RSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLENBQUM7SUFFRCx3Q0FBd0M7SUFDeEMsTUFBTSxLQUFLLEdBQUc7UUFDWixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87UUFDckIsRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDbkUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1FBQ2YsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO0tBQ2xCLENBQUM7SUFFRixxREFBcUQ7SUFDckQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUUvQixPQUFPLENBQUMsR0FBRyxDQUFDLGlDQUFpQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUMzRCxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixFQUFFO1FBQ2hDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxJQUFJLGFBQWE7UUFDdkMsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSTtLQUN0QyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsMkJBQU8sRUFBQyxLQUFLLENBQUMsQ0FBQztRQUVwQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXJDLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDdkMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO2dCQUNyQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBYyxFQUFFLEVBQUU7b0JBQ2hELE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsT0FBTyxLQUFLLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUMzRCxDQUFDLENBQUMsQ0FBQztZQUNMLENBQUM7aUJBQU0sQ0FBQztnQkFDTixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDdkMsQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ04sT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ25DLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDN0MsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsQixDQUFDO0lBQ0gsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3BELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztBQUNILENBQUM7QUFFRCxJQUFJLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IHRzLW5vZGVcblxuaW1wb3J0IHsgaGFuZGxlciB9IGZyb20gJy4uL3BhY2thZ2VzL2luZnJhc3RydWN0dXJlLXRvb2xzL3NyYy9taWdyYXRpb24taGFuZGxlcic7XG5pbXBvcnQgKiBhcyB5YXJncyBmcm9tICd5YXJncyc7XG5cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSB7XG4gIC8vIFBhcnNlIGNvbW1hbmQgbGluZSBhcmd1bWVudHNcbiAgY29uc3QgYXJndiA9IHlhcmdzXG4gICAgLm9wdGlvbignc3RhZ2UnLCB7XG4gICAgICBhbGlhczogJ3MnLFxuICAgICAgZGVzY3JpcHRpb246ICdEZXBsb3ltZW50IHN0YWdlJyxcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZGVmYXVsdDogcHJvY2Vzcy5lbnYuU1RBR0UgfHwgJ2RldicsXG4gICAgfSlcbiAgICAub3B0aW9uKCd2ZXJzaW9uJywge1xuICAgICAgYWxpYXM6ICd2JyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUnVuIGEgc3BlY2lmaWMgbWlncmF0aW9uIHZlcnNpb24nLFxuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgfSlcbiAgICAub3B0aW9uKCd1cCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnUnVuIGFsbCBwZW5kaW5nIG1pZ3JhdGlvbnMnLFxuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgfSlcbiAgICAub3B0aW9uKCdkb3duJywge1xuICAgICAgZGVzY3JpcHRpb246ICdSb2xsYmFjayB0aGUgbGFzdCBtaWdyYXRpb24nLFxuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgfSlcbiAgICAuaGVscCgpXG4gICAgLmFsaWFzKCdoZWxwJywgJ2gnKVxuICAgIC5hcmd2O1xuXG4gIC8vIENoZWNrIGZvciBpbmNvbXBhdGlibGUgb3B0aW9uc1xuICBpZiAoXG4gICAgKGFyZ3YudmVyc2lvbiAmJiBhcmd2LnVwKSB8fFxuICAgIChhcmd2LnZlcnNpb24gJiYgYXJndi5kb3duKSB8fFxuICAgIChhcmd2LnVwICYmIGFyZ3YuZG93bilcbiAgKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3I6IFNwZWNpZnkgb25seSBvbmUgb2YgLS12ZXJzaW9uLCAtLXVwLCBvciAtLWRvd24nKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cblxuICAvLyBEZWZhdWx0IHRvIC0tdXAgaWYgbm8gb3B0aW9uIHByb3ZpZGVkXG4gIGNvbnN0IGV2ZW50ID0ge1xuICAgIHZlcnNpb246IGFyZ3YudmVyc2lvbixcbiAgICB1cDogYXJndi52ZXJzaW9uID8gZmFsc2UgOiBhcmd2LnVwIHx8ICghYXJndi5kb3duICYmICFhcmd2LnZlcnNpb24pLFxuICAgIGRvd246IGFyZ3YuZG93bixcbiAgICBzdGFnZTogYXJndi5zdGFnZSxcbiAgfTtcblxuICAvLyBTZXQgZW52aXJvbm1lbnQgdmFyaWFibGUgZm9yIHRoZSBtaWdyYXRpb24gaGFuZGxlclxuICBwcm9jZXNzLmVudi5TVEFHRSA9IGFyZ3Yuc3RhZ2U7XG5cbiAgY29uc29sZS5sb2coYFJ1bm5pbmcgbWlncmF0aW9ucyBmb3Igc3RhZ2U6ICR7YXJndi5zdGFnZX1gKTtcbiAgY29uc29sZS5sb2coJ01pZ3JhdGlvbiBvcHRpb25zOicsIHtcbiAgICB2ZXJzaW9uOiBldmVudC52ZXJzaW9uIHx8ICdhbGwgcGVuZGluZycsXG4gICAgZGlyZWN0aW9uOiBldmVudC5kb3duID8gJ2Rvd24nIDogJ3VwJyxcbiAgfSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBoYW5kbGVyKGV2ZW50KTtcbiAgICBcbiAgICBpZiAocmVzdWx0LnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgY29uc29sZS5sb2coJ01pZ3JhdGlvbnMgY29tcGxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UocmVzdWx0LmJvZHkpO1xuICAgICAgXG4gICAgICBpZiAoYm9keS5hcHBsaWVkTWlncmF0aW9ucz8ubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zb2xlLmxvZygnXFxuQXBwbGllZCBtaWdyYXRpb25zOicpO1xuICAgICAgICBib2R5LmFwcGxpZWRNaWdyYXRpb25zLmZvckVhY2goKG1pZ3JhdGlvbjogYW55KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coYC0gJHttaWdyYXRpb24udmVyc2lvbn06ICR7bWlncmF0aW9uLm5hbWV9YCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ05vIG1pZ3JhdGlvbnMgYXBwbGllZCcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdNaWdyYXRpb24gZmFpbGVkOicpO1xuICAgICAgY29uc29sZS5lcnJvcihKU09OLnBhcnNlKHJlc3VsdC5ib2R5KS5lcnJvcik7XG4gICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGV4ZWN1dGluZyBtaWdyYXRpb25zOicsIGVycm9yKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cbn1cblxubWFpbigpOyAiXX0=