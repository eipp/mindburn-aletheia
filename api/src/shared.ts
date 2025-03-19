// Simple logger implementation to replace @mindburn/shared
export function createLogger(componentName: string) {
  return {
    info: (message: string, meta?: any) => {
      console.log(`[INFO] [${componentName}] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[WARN] [${componentName}] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    error: (message: string, meta?: any) => {
      console.error(`[ERROR] [${componentName}] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    debug: (message: string, meta?: any) => {
      console.debug(`[DEBUG] [${componentName}] ${message}`, meta ? JSON.stringify(meta) : '');
    },
    child: (meta: any) => createLogger(`${componentName}:${JSON.stringify(meta)}`)
  };
}

// Mock environment transformer
export function createEnvironmentTransformer(env: any) {
  return env;
}

// Other shared utility functions
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Mock service factory
export function createTonService(config: any, logger: any) {
  return {
    sendPayment: async () => ({ success: true, txId: generateId() })
  };
}

// Simplified validation
export function validateInput(data: any, schema: any): boolean {
  return true; // Simplified for testing
} 