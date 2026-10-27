/* eslint-disable no-console */
// Secure initial admin creation. There are no default credentials anywhere in this project.
// Interactive:      npm run create-admin
// Non-interactive:  ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_PASSWORD="..." npm run create-admin
// The first account created is the 'owner'; later runs create 'admin' accounts (use --role=staff for staff).
import readline from 'node:readline';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/index.js';
import { email as emailSchema, password as passwordSchema } from '../validators/common.js';

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Mask typed characters so the password never appears on screen or in terminal scrollback.
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, '*'));
  }
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); }));
}

async function main() {
  const roleArg = process.argv.find((a) => a.startsWith('--role='))?.split('=')[1];
  await connectDB();

  const hasOwner = await User.exists({ role: 'owner' });
  const role = hasOwner ? (['admin', 'staff'].includes(roleArg) ? roleArg : 'admin') : 'owner';

  const name = process.env.ADMIN_NAME || (await ask('Full name: '));
  const emailIn = process.env.ADMIN_EMAIL || (await ask('Email: '));
  let pass = process.env.ADMIN_PASSWORD;
  if (!pass) {
    pass = await ask('Password (min 8 chars, upper, lower, number): ', { hidden: true });
    const confirm = await ask('Confirm password: ', { hidden: true });
    if (pass !== confirm) throw new Error('Passwords do not match');
  }

  const email = emailSchema.parse(emailIn);
  const pw = passwordSchema.safeParse(pass);
  if (!pw.success) throw new Error(pw.error.issues.map((i) => i.message).join('; '));
  if (!name || name.length < 2) throw new Error('Name is required');

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === 'member' && process.argv.includes('--promote')) {
      existing.role = role;
      await existing.save();
      console.log(`Promoted ${email} to ${role}.`);
      return;
    }
    throw new Error('A user with this email already exists (use --promote to promote a member).');
  }

  await User.create({ name, email, password: pass, role, emailVerified: true });
  console.log(`Created ${role} account for ${email}. Log in at /login, then open /admin.`);
}

main()
  .catch((err) => {
    console.error(`create-admin failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB().catch(() => {}));
