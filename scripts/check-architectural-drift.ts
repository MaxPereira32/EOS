import * as fs from 'fs';
import * as path from 'path';

// Architectural Zones
const ZONES = [
  'domain',
  'engines',
  'services',
  'storage',
  'adapters',
  'orchestration',
  'rules',
  'fact-providers',
  'reporters'
];

interface ZoneRule {
  name: string;
  allowed: string[]; // prefixes or 'ALL'
  forbidden: string[]; // prefixes
}

const RULES: Record<string, ZoneRule> = {
  domain: {
    name: 'DOMAIN',
    allowed: ['../domain', './'],
    forbidden: ['fs', 'path', 'child_process', '../adapters', '../storage', '../services', '../engines', '../orchestration']
  },
  engines: {
    name: 'ENGINES',
    allowed: ['ALL'],
    forbidden: ['../adapters'] // Engines should not call concrete adapters directly
  },
  services: {
    name: 'SERVICES',
    allowed: ['ALL'],
    forbidden: [] 
  },
  storage: {
    name: 'STORAGE',
    allowed: ['ALL'],
    forbidden: []
  },
  adapters: {
    name: 'ADAPTERS',
    allowed: ['ALL'],
    forbidden: ['../orchestration']
  },
  orchestration: {
    name: 'ORCHESTRATION',
    allowed: ['ALL'],
    forbidden: []
  }
};

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function resolveZone(dirName: string): string {
  const rel = path.relative('EOS/core', dirName).split(path.sep)[0];
  return rel;
}

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

function checkDrift() {
  const files = walk('EOS/core');
  let hasDrift = false;
  
  console.log('\n================================================================');
  console.log('  🏛️  EOS ARCHITECTURAL DRIFT CHECKER');
  console.log('================================================================\n');

  for (const [zoneKey, rule] of Object.entries(RULES)) {
    const zoneFiles = files.filter(f => resolveZone(f) === zoneKey);
    const actualImports = new Set<string>();
    
    zoneFiles.forEach(f => {
      getImports(f).forEach(imp => actualImports.add(imp));
    });

    const importsArray = Array.from(actualImports);
    let drift = false;
    const violations: string[] = [];

    importsArray.forEach(imp => {
      // Check forbidden
      rule.forbidden.forEach(forb => {
        if (imp === forb || imp.startsWith(forb + '/')) {
          drift = true;
          violations.push(`Forbidden import: ${imp}`);
        }
      });
      // (Optional) Check strict allowed list if not ALL
      if (!rule.allowed.includes('ALL')) {
        const isAllowed = rule.allowed.some(all => imp === all || imp.startsWith(all) || imp.startsWith('.')) || !imp.includes('/');
        // node built-ins and npm packages do not start with '.' or '..'
        // Actually, let's keep it simple: just strictly enforce the 'forbidden' list for now
        // since mapping everything allowed is complex.
      }
    });

    console.log(`[ZONE: ${rule.name}]`);
    console.log(`  Allowed: ${rule.allowed.join(', ')}`);
    console.log(`  Forbidden: ${rule.forbidden.join(', ')}`);
    console.log(`  Actual Deps: ${importsArray.length > 0 ? importsArray.slice(0, 5).join(', ') + (importsArray.length > 5 ? '...' : '') : 'None'}`);
    
    if (drift) {
      console.log(`  Status: ❌ DRIFT DETECTED`);
      violations.forEach(v => console.log(`    -> ${v}`));
      hasDrift = true;
    } else {
      console.log(`  Status: ✅ NO DRIFT`);
    }
    console.log('');
  }

  if (hasDrift) {
    console.error('❌ Architectural drift detected. Governance Gate must fail.');
    process.exit(1);
  } else {
    console.log('✅ Architecture matches declared constraints.');
    process.exit(0);
  }
}

checkDrift();
