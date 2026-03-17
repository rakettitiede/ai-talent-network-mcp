import { createServer } from 'net';

const PORTS = [8080, 3000, 3001];

async function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(port, () => { server.close(); resolve(); });
    server.on('error', reject);
  });
}

for (const port of PORTS) {
  try {
    await checkPort(port);
  } catch {
    console.error(`\n ${'='.repeat(60)}`);
    console.error(` ____________________________________`);
    console.error(`< ❌ Port ${port} already in use! >`);
    console.error(` ------------------------------------`);
    console.error(`        \\   ^__^`);
    console.error(`         \\  (oo)\\_______`);
    console.error(`            (__)\\       )\\/\\`);
    console.error(`                ||----w |`);
    console.error(`                ||     ||`);
    console.error(`\n💡 Tip: Stop the running server with: fuser -k ${port}/tcp`);
    console.error(`${'='.repeat(60)}\n`);
    process.exit(1);
  }
}

console.log('✅ All ports available');
