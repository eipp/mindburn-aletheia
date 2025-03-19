# Development Process

This document outlines the development process for the Mindburn Aletheia project, focusing on validation and tracking.

## Validation

After each task, run validation to catch issues early:

```bash
# Run both lint and test
pnpm validate

# Or individually
pnpm turbo run lint
pnpm turbo run test
```

### Automated Validation

A GitHub Action will automatically run validation on all branches and pull requests. The results will be posted as a comment on PRs.

## Tracking Progress

### GitHub Issues

Create a GitHub issue for each task using the provided template. Issues should include:

- Clear description of the task
- Acceptance criteria
- Technical implementation details
- Affected packages/files
- Validation strategy

### Pull Requests

1. Create small, focused PRs with descriptive titles following the conventional commit format:
   ```
   feat: convert MigrationManager to TypeScript
   fix: resolve race condition in worker assignment
   ```

2. Reference the issue number in the PR description using "Fixes #123" or "Relates to #456"

3. Complete the validation checklist before requesting review

4. After approval, merge to main branch

5. Delete the feature branch after merging

## Commit Messages

Use the standardized commit message format:

```
feat: add JWT authentication to API endpoints
fix: prevent race condition in worker assignment
refactor: convert MigrationManager to TypeScript
security: sanitize user input in verification form
```

Valid types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Formatting changes (no code change)
- `refactor`: Code restructuring (no feature/fix)
- `perf`: Performance improvements
- `test`: Adding/fixing tests
- `chore`: Build process or tooling changes
- `security`: Security-related changes
- `deps`: Dependency updates

You can configure Git to use our commit template:

```bash
git config --local commit.template .github/commit-template.txt
```

## Branch Management

- Create feature branches from main
- Keep branches short-lived
- Delete branches after merging
- Use descriptive branch names (e.g., `feat/jwt-auth`, `fix/worker-race-condition`)

## Best Practices

1. **Small Pull Requests**: Easier to review and less likely to cause conflicts
2. **Validate Early and Often**: Run `pnpm validate` before committing
3. **Link Issues to PRs**: Create traceability between issues and code changes
4. **Update Documentation**: Keep docs in sync with code changes
5. **Clean Commit History**: Use meaningful commit messages 