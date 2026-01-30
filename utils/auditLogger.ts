
/**
 * Utilitário de Auditoria para Cálculos Financeiros
 */

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  details: any;
  result: any;
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];

  log(operation: string, details: any, result: any) {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      operation,
      details,
      result,
    };
    
    this.logs.push(entry);
    
    // Em produção, isso poderia ser enviado para um serviço de logs ou banco de dados
    console.log(`[AUDIT][${entry.operation}]`, {
      details: entry.details,
      result: entry.result
    });
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

export const auditLogger = new AuditLogger();
