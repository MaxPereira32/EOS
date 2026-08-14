import * as fs from 'fs';
import * as path from 'path';
import { AuditReport } from '../domain/types';

export class JsonReporter {
  public static writeReport(report: AuditReport, outputDir: string = '.eos'): string {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'auditoria.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    return outputPath;
  }
}
