import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { APP_CONFIG, type AppConfig } from '../config.js';
import * as schema from './schema.js';

export type Db = PostgresJsDatabase<typeof schema>;
/** The database or an open transaction; services take this so callers can compose transactions. */
export type DbLike = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
export const DB = Symbol('DB');
const SQL_CLIENT = Symbol('SQL_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: SQL_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => postgres(config.DATABASE_URL, { max: 10 }),
    },
    {
      provide: DB,
      inject: [SQL_CLIENT],
      useFactory: (client: postgres.Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown() {
    await this.client.end({ timeout: 5 });
  }
}
