import { readFileSync } from 'fs';
import { reviewCode } from './agent.js';

// Env vars consumed:
//   PR_TITLE        — required; passed from github.event.pull_request.title
//   PR_DESCRIPTION  — optional; passed from github.event.pull_request.body
//   GIT_DIFF_FILE   — path to file containing the git diff
// Output: JSON.stringify(ReviewOutput) + newline on stdout
// On error: stderr message + process.exit(1)

const { PR_TITLE, PR_DESCRIPTION, GIT_DIFF_FILE } = process.env;

if (!PR_TITLE) {
  process.stderr.write('Error: PR_TITLE environment variable is required\n');
  process.exit(1);
}

if (!GIT_DIFF_FILE) {
  process.stderr.write('Error: GIT_DIFF_FILE environment variable is required\n');
  process.exit(1);
}

let gitDiff: string;
try {
  gitDiff = readFileSync(GIT_DIFF_FILE, 'utf-8');
} catch (err) {
  process.stderr.write(`Error: could not read GIT_DIFF_FILE at ${GIT_DIFF_FILE}: ${err}\n`);
  process.exit(1);
}

reviewCode({
  prTitle: PR_TITLE,
  prDescription: PR_DESCRIPTION,
  gitDiff,
})
  .then((result) => {
    process.stdout.write(JSON.stringify(result) + '\n');
  })
  .catch((err) => {
    process.stderr.write(`Error: review failed: ${err}\n`);
    process.exit(1);
  });
