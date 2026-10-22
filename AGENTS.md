# Agent guidelines

## GitHub Actions and local checks

Owner policy (2026-10-22): GitHub Actions must remain disabled for this repository.
- Run tests, lint, builds, security checks, packaging and other automation locally on the authorized development host. Use existing project scripts and report the commands and exit results.
- Do not create, enable, trigger, repair or depend on GitHub Actions workflows, including self-hosted Actions runners. Existing workflow files are historical references for local commands only.
- Do not require GitHub Actions status checks in branch protection or rulesets. This policy supersedes older CI/Actions directions in project documentation; changing it requires an explicit owner instruction.
