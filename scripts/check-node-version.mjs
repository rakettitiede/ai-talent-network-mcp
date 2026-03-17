const currentNodeVersion = process.version;
const requiredVersion = 'v24.12.0';

if (currentNodeVersion === requiredVersion) {
  console.log(`✅ Node version ${currentNodeVersion} matches required version ${requiredVersion}`);
  process.exit(0);
} else {
  console.error(`\n ${'='.repeat(60)}`);
  console.error(` ____________________________________`);
  console.error(`< ❌ Wrong Node version! Run: nvm use >`);
  console.error(` ------------------------------------`);
  console.error(`        \\   ^__^`);
  console.error(`         \\  (oo)\\_______`);
  console.error(`            (__)\\       )\\/\\`);
  console.error(`                ||----w |`);
  console.error(`                ||     ||`);
  console.error(`\n📋 Version Details:`);
  console.error(`     Current:  ${currentNodeVersion}`);
  console.error(`     Required: ${requiredVersion}`);
  console.error(`\n💡 Tip: Run 'nvm use' to switch to the correct version`);
  console.error(`${'='.repeat(60)}\n`);
  process.exit(1);
}
