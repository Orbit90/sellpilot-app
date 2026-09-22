import { Pool, PoolClient, PoolConfig } from 'pg';
import { newDb, IMemoryDb, DataType } from 'pg-mem';

let activePool: Pool | null = null;
let memoryDbInstance: IMemoryDb | null = null;
let isUsingExternalDb = false;
let externalConnectionError: string | null = null;

export function isExternalPostgres(): boolean {
  return isUsingExternalDb;
}

export function getExternalDbError(): string | null {
  return externalConnectionError;
}

/**
 * Robustly parses a PostgreSQL connection string into connection options,
 * with automatic support for Supabase connection poolers and special character passwords.
 */
export function parsePgUrl(rawUrl: string): PoolConfig | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return null;
  }

  try {
    const protoIdx = trimmed.indexOf('://');
    let pathAndQuery = trimmed.slice(protoIdx + 3);
    let queryParams: URLSearchParams | null = null;
    const questionIdx = pathAndQuery.indexOf('?');
    if (questionIdx !== -1) {
      queryParams = new URLSearchParams(pathAndQuery.slice(questionIdx + 1));
      pathAndQuery = pathAndQuery.slice(0, questionIdx);
    }

    const lastAt = pathAndQuery.lastIndexOf('@');
    let user = 'postgres';
    let password = '';
    let hostPortDb = pathAndQuery;

    if (lastAt !== -1) {
      const userPass = pathAndQuery.slice(0, lastAt);
      hostPortDb = pathAndQuery.slice(lastAt + 1);
      const colonIdx = userPass.indexOf(':');
      if (colonIdx !== -1) {
        user = decodeURIComponent(userPass.slice(0, colonIdx));
        const rawPass = userPass.slice(colonIdx + 1);
        try {
          password = decodeURIComponent(rawPass);
        } catch {
          password = rawPass;
        }
      } else {
        user = decodeURIComponent(userPass);
      }
    }

    // Auto-detect duplicated copy-pasted password string
    if (
      password.length >= 10 &&
      password.length % 2 === 0 &&
      password.slice(0, password.length / 2) === password.slice(password.length / 2)
    ) {
      password = password.slice(0, password.length / 2);
    }

    const slashIdx = hostPortDb.indexOf('/');
    let hostPort = hostPortDb;
    let database = 'postgres';

    if (slashIdx !== -1) {
      hostPort = hostPortDb.slice(0, slashIdx);
      database = hostPortDb.slice(slashIdx + 1) || 'postgres';
    }

    let host = hostPort;
    let port = 5432;
    const colonHost = hostPort.lastIndexOf(':');
    if (colonHost !== -1) {
      host = hostPort.slice(0, colonHost);
      const parsedPort = parseInt(hostPort.slice(colonHost + 1), 10);
      if (!isNaN(parsedPort)) {
        port = parsedPort;
      }
    }

    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    let ssl: any = isLocalhost ? false : { rejectUnauthorized: false };
    if (queryParams && queryParams.get('sslmode') === 'disable') {
      ssl = false;
    }

    return {
      user,
      password,
      host,
      port,
      database,
      ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  } catch (err) {
    console.error('Error parsing PostgreSQL connection string:', err);
    return null;
  }
}

export function createEmbeddedPool(): Pool {
  if (memoryDbInstance && activePool && !isUsingExternalDb) {
    return activePool;
  }
  console.log('Using in-memory PostgreSQL engine (pg-mem) for resilient relational storage...');
  memoryDbInstance = newDb();
  memoryDbInstance.registerLanguage('plpgsql', () => () => null);
  memoryDbInstance.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.text,
    implementation: () => 'uuid_' + Math.random().toString(36).substring(2, 15),
  });

  const adapter = memoryDbInstance.adapters.createPg();
  activePool = new adapter.Pool() as unknown as Pool;
  isUsingExternalDb = false;
  return activePool;
}

/**
 * Initializes and verifies the database pool with resilient fallback.
 */
export async function initPool(): Promise<Pool> {
  if (activePool) {
    return activePool;
  }

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl.trim().length > 0) {
    const baseConfig = parsePgUrl(dbUrl);
    if (baseConfig) {
      // Build candidate configs (e.g. Supabase IPv4 pooler resolution)
      const candidateConfigs: PoolConfig[] = [];

      if (baseConfig.host && baseConfig.host.endsWith('.supabase.co')) {
        let projectRef = '';
        if (baseConfig.host.startsWith('db.')) {
          projectRef = baseConfig.host.slice(3, -12);
        } else {
          projectRef = baseConfig.host.slice(0, -12);
        }

        const poolerUser = projectRef ? `postgres.${projectRef}` : (baseConfig.user || 'postgres');

        // Supabase pooler in detected project region (eu-central-1) on session pooler port 5432
        candidateConfigs.push({
          ...baseConfig,
          host: 'aws-0-eu-central-1.pooler.supabase.com',
          port: 5432,
          user: poolerUser,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 4000,
        });

        // Also add candidate for transaction pooler port 6543
        candidateConfigs.push({
          ...baseConfig,
          host: 'aws-0-eu-central-1.pooler.supabase.com',
          port: 6543,
          user: poolerUser,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 4000,
        });
      }

      // Add original base config as candidate as well
      candidateConfigs.push(baseConfig);

      for (const config of candidateConfigs) {
        console.log(`Connecting to PostgreSQL database at host: ${config.host}:${config.port}...`);
        let testPool: Pool | null = null;
        let testClient: PoolClient | null = null;
        try {
          testPool = new Pool(config);
          testPool.on('error', (err) => {
            console.error('Unexpected error on idle external PostgreSQL client:', err);
          });

          // Test with a quick query
          testClient = await testPool.connect();
          await testClient.query('SELECT 1');
          testClient.release();
          testClient = null;

          activePool = testPool;
          isUsingExternalDb = true;
          externalConnectionError = null;
          console.log(`✅ Successfully connected to external PostgreSQL database at ${config.host}!`);
          return activePool;
        } catch (err: any) {
          if (testClient) {
            try { (testClient as any).release(); } catch {}
          }
          if (testPool) {
            try { await testPool.end(); } catch {}
          }
          externalConnectionError = err.message || 'Connection failed';
          console.warn(`⚠️ Could not connect to PostgreSQL (${config.host}:${config.port}): ${err.message}. Trying next candidate...`);
        }
      }

      console.warn('⚠️ All external PostgreSQL connection candidates exhausted.');
    } else {
      console.warn('Invalid DATABASE_URL format.');
    }
  }

  console.log('🔄 Using embedded relational engine (pg-mem) to keep store running.');
  return createEmbeddedPool();
}

export function getPool(): Pool {
  if (activePool) {
    return activePool;
  }
  return createEmbeddedPool();
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  if (!activePool) {
    await initPool();
  }
  const pool = activePool || getPool();
  const res = await pool.query(text, params);
  return {
    rows: (res.rows as T[]) || [],
    rowCount: res.rowCount ?? res.rows?.length ?? 0,
  };
}

export async function getClient(): Promise<PoolClient> {
  if (!activePool) {
    await initPool();
  }
  const pool = activePool || getPool();
  return pool.connect();
}

/**
 * Executes operations within an atomic PostgreSQL transaction.
 * If any error is thrown, rolls back all changes.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error during transaction rollback:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}
