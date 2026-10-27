// Installs language packages into a self-hosted Piston instance.
//
//   node scripts/install-runtimes.mjs                 # a sensible default set
//   node scripts/install-runtimes.mjs python rust go  # specific Piston packages
//   node scripts/install-runtimes.mjs --all           # every available package
//
// Uses PISTON_URL (default http://localhost:2000/api/v2).

const base = (process.env.PISTON_URL || 'http://localhost:2000/api/v2').replace(/\/+$/, '');
const DEFAULTS = ['python', 'node', 'typescript', 'gcc', 'java', 'go', 'rust', 'ruby', 'php', 'bash'];

const compare = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

const res = await fetch(`${base}/packages`).catch((err) => {
  console.error(`Cannot reach Piston at ${base}: ${err.message}`);
  process.exit(1);
});
const packages = await res.json();

const latest = new Map();
for (const p of packages) {
  const current = latest.get(p.language);
  if (!current || compare(p.language_version, current.language_version) > 0) latest.set(p.language, p);
}

const args = process.argv.slice(2);
const wanted = args.includes('--all') ? [...latest.keys()] : args.length ? args : DEFAULTS;

for (const name of wanted) {
  const pkg = latest.get(name);
  if (!pkg) {
    console.warn(`- ${name}: no such package (see ${base}/packages)`);
    continue;
  }
  if (pkg.installed) {
    console.log(`= ${name} ${pkg.language_version} already installed`);
    continue;
  }
  process.stdout.write(`+ ${name} ${pkg.language_version} ... `);
  const install = await fetch(`${base}/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: name, version: pkg.language_version }),
  });
  const body = await install.json().catch(() => ({}));
  console.log(install.ok ? 'done' : `failed: ${body.message ?? install.status}`);
}
