# Contributing to Mindburn Aletheia

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Issues

1. Search the [issue tracker](https://github.com/mindburn/aletheia/issues) to avoid duplicates
2. Use our issue templates:
   - Bug Report
   - Feature Request
   - Security Vulnerability
3. Provide detailed information:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots if applicable

### Pull Requests

1. Fork the repository
2. Create a feature branch:
```bash
git checkout -b feature/description
```

3. Make your changes:
   - Follow code style guidelines
   - Add/update tests
   - Update documentation
   - Keep commits atomic and well-described

4. Commit messages:
```
type(scope): description

[optional body]

[optional footer]
```
Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Tests
- chore: Maintenance

5. Push to your fork:
```bash
git push origin feature/description
```

6. Open a Pull Request:
   - Use the PR template
   - Link related issues
   - Add reviewers
   - Pass all checks

### Development Standards

#### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Keep functions small and focused
- Write self-documenting code
- Add JSDoc comments for public APIs

#### Testing

- Write unit tests for new features
- Update existing tests when modifying code
- Aim for high test coverage
- Include integration tests for API endpoints
- Add e2e tests for critical flows

#### Documentation

- Update README files
- Document new features
- Update API documentation
- Add inline code comments
- Update architecture diagrams

#### Performance

- Consider performance implications
- Optimize database queries
- Use caching where appropriate
- Monitor bundle sizes
- Profile code when needed

#### Security

- Follow security best practices
- Never commit secrets
- Validate all inputs
- Use prepared statements
- Keep dependencies updated

### Review Process

1. Code Review
   - At least one approval required
   - Address all comments
   - Pass all checks
   - Follow up with fixes

2. Testing
   - All tests must pass
   - No regressions
   - Performance impact acceptable
   - Security implications reviewed

3. Documentation
   - Documentation updated
   - API docs current
   - Release notes prepared

### Release Process

See [Release Process](../release/RELEASE_PROCESS.md) for detailed instructions.

## Development Setup

See [Development Guide](../development/README.md) for setup instructions.

## Community

- Join our [Discord](https://discord.gg/mindburn)
- Follow us on [Twitter](https://twitter.com/mindburn)
- Read our [Blog](https://blog.mindburn.org)

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Featured on our website
- Invited to our contributor program

## Questions?

- Check our [FAQ](../FAQ.md)
- Ask in Discord
- Email: contribute@mindburn.org

## License

By contributing, you agree that your contributions will be licensed under the MIT License. 