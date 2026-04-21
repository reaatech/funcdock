import { execSync } from 'child_process';

try {
  execSync('husky', { stdio: 'inherit' });
} catch {
  console.log('husky not available, skipping');
}
