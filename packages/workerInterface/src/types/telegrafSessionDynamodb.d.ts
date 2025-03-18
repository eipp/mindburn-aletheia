declare module 'telegraf-session-dynamodb' {
  import { SessionStore } from 'telegraf/typings/session';

  export interface DynamoDBSessionStoreOptions {
    tableName: string;
    ttl?: number;
  }

  export class DynamoDBSessionStore<T = any> implements SessionStore<T> {
    constructor(options: DynamoDBSessionStoreOptions);
  }
}
