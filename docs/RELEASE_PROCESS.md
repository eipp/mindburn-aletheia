# Release Process

This document outlines the release process for Mindburn Aletheia.

## Version Management

We follow [Semantic Versioning](https://semver.org/):
- MAJOR version for incompatible API changes
- MINOR version for new features in a backward-compatible manner
- PATCH version for backward-compatible bug fixes

## Release Flow

1. **Development**
   - All development happens in feature branches
   - PRs are merged into `main` after review
   - CI pipeline runs tests and checks

2. **Release Preparation**
   - Ensure all tests pass on `main`
   - Update dependencies if needed
   - Review and update documentation

3. **Creating a Release**
   - Go to Actions > Release workflow
   - Input the new version number (e.g., 1.2.3)
   - Select release type (patch/minor/major)
   - The workflow will:
     - Update version in package.json
     - Generate changelog
     - Create GitHub release
     - Tag the repository
     - Trigger deployment to staging

4. **Staging Deployment**
   - Automated deployment to staging environment
   - Run integration tests
   - Manual QA verification
   - Monitor for any issues

5. **Production Deployment**
   - Requires manual approval
   - Go to Actions > Deploy workflow
   - Select 'prod' environment
   - Monitor deployment progress
   - Verify production functionality

## Rollback Process

If issues are detected after deployment:

1. **Immediate Actions**
   - Go to Actions > Rollback workflow
   - Select environment (staging/prod)
   - Input the version to rollback to
   - Monitor rollback progress

2. **Post-Rollback**
   - Document the issues
   - Create incident report
   - Plan fixes in new release

## Environment Management

### Development (dev)
- Automatic deployments from `main`
- Used for feature testing
- No approval required

### Staging
- Deployment triggered by releases
- Used for pre-production verification
- Requires QA approval

### Production (prod)
- Manual deployment after staging verification
- Requires senior team approval
- Monitored deployment

## Security Considerations

1. **Secrets Management**
   - AWS credentials in GitHub Secrets
   - Environment-specific variables
   - Rotation schedule for keys

2. **Access Control**
   - Limited production access
   - Required approvals
   - Audit logging

## Monitoring

1. **Deployment Health**
   - Automated health checks
   - Performance metrics
   - Error tracking

2. **Notifications**
   - Telegram alerts for:
     - Deployment status
     - Release creation
     - Rollbacks
     - Failures

## Checklist

### Pre-Release
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Dependencies reviewed
- [ ] Breaking changes documented

### Release
- [ ] Version bumped
- [ ] Changelog generated
- [ ] Release notes reviewed
- [ ] Tags created

### Post-Release
- [ ] Staging deployment successful
- [ ] QA verification completed
- [ ] Production deployment approved
- [ ] Monitoring in place

## Troubleshooting

### Common Issues

1. **Failed Deployment**
   - Check logs in GitHub Actions
   - Verify AWS credentials
   - Check resource limits

2. **Failed Health Checks**
   - Verify service endpoints
   - Check error logs
   - Monitor resource usage

3. **Rollback Issues**
   - Verify previous version
   - Check database migrations
   - Monitor data consistency

## Contact

For release-related issues:
- **Technical Lead**: @tech-lead
- **DevOps Team**: @devops-team
- **Emergency Contact**: @on-call-engineer 