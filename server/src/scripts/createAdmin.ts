/**
 * Creates the first administrator account securely.
 *
 *   npm run create-admin
 *
 * Reads ADMIN_BOOTSTRAP_NAME / ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD, or prompts
 * interactively. Refuses weak passwords and refuses to run if an admin already exists
 * (pass --additional to add another admin deliberately). No default credentials exist.
 */
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { connectDb, disconnectDb } from '../config/db';
import { UserModel } from '../models';
import { hashPassword } from '../services/auth.service';
import { emailSchema, passwordSchema } from '../validators/auth.validators';

async function ask(rl: readline.Interface, q: string) {
  return (await rl.question(q)).trim();
}

async function main() {
  await connectDb();
  const additional = process.argv.includes('--additional');
  const existing = await UserModel.countDocuments({ role: 'admin' });
  if (existing > 0 && !additional) {
    console.error('An admin already exists. Use the admin dashboard to add staff, or pass --additional.');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const name = process.env.ADMIN_BOOTSTRAP_NAME || (await ask(rl, 'Admin name: '));
  const email = emailSchema.parse(process.env.ADMIN_BOOTSTRAP_EMAIL || (await ask(rl, 'Admin email: ')));
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || (await ask(rl, 'Password (min 10 chars, letters + numbers): '));
  rl.close();
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) {
    console.error(`Weak password: ${pw.error.issues[0].message}`);
    process.exit(1);
  }
  if (await UserModel.exists({ email })) {
    console.error('A user with this email already exists.');
    process.exit(1);
  }
  await UserModel.create({ name: name || 'Owner', email, passwordHash: await hashPassword(password), role: 'admin', emailVerified: true });
  console.log(`Admin ${email} created. Remove ADMIN_BOOTSTRAP_PASSWORD from your environment now.`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
