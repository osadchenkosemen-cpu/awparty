const { execSync } = require('child_process');
try {
    execSync('git config core.hooksPath scripts/hooks', { stdio: 'ignore' });
    console.log('git hooks enabled (core.hooksPath=scripts/hooks)');
} catch (e) {
}
