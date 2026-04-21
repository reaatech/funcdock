> **Note:** This document has been superseded by [CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root. Please refer to that file for the latest contribution guidelines.
>
> This copy is retained for historical reference.

# 🚀 FuncDock — Contributing Guide

Thank you for your interest in contributing to FuncDock! This guide will help you get started.

## Index

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Branch Naming](#branch-naming)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

---

## Getting Started

### Before You Begin

1. **Check existing issues** - Your idea might already be discussed or in progress
2. **Discuss major changes** - Open an issue first for significant features
3. **Read the documentation** - Familiarize yourself with the codebase structure

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug fixes** - Fix issues and improve stability
- ✨ **New features** - Add functionality to the platform
- 📚 **Documentation** - Improve guides, examples, and API docs
- 🧪 **Tests** - Add or improve test coverage
- 🎨 **UI/UX** - Enhance the dashboard experience
- 🔧 **Tooling** - Improve developer experience and scripts

---

## Development Setup

### Prerequisites

- Node.js 22+
- Git configured with your credentials
- Docker (optional, for containerized testing)
- `jq` for JSON processing

### Setup Steps

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/funcdock.git
   cd funcdock
   ```

2. **Install dependencies**

   ```bash
   npm install
   npm run setup
   ```

3. **Start development server**

   ```bash
   npm run dev
   # Or with Docker
   make quickstart
   ```

4. **Run tests**
   ```bash
   npm test
   ```

---

## Code Style Guidelines

### General Principles

- **ES Modules** - Use `export default` and `import` (not CommonJS)
- **Async/Await** - Prefer async/await over promises
- **Error Handling** - Always handle errors appropriately
- **Comments** - Write clear, concise comments for complex logic
- **Naming** - Use descriptive, camelCase names for variables and functions

### JavaScript Style

**Function Exports:**

```javascript
// ✅ Good - ES module export
export default async function handler(req, res, next) {
  // handler logic
}

// ❌ Bad - CommonJS
module.exports = async (req, res) => { ... }
```

**Async Functions:**

```javascript
// ✅ Good - Proper error handling
export default async function handler(req, res) {
  try {
    const result = await someAsyncOperation();
    res.json(result);
  } catch (error) {
    logger.error('Operation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
}
```

**Code Organization:**

- Keep functions focused and single-purpose
- Use early returns to reduce nesting
- Group related functionality together
- Export only what's necessary

### File Structure

- Place function handlers in `functions/{function-name}/`
- Use descriptive file names (`handler.js`, `cron-handler.js`, etc.)
- Keep test files next to source files (`handler.test.mjs`)

### Formatting

- Use consistent indentation (2 spaces)
- Add trailing commas in multi-line objects/arrays
- Keep lines under 100 characters when possible
- Use semicolons consistently

---

## Testing Requirements

### Test Coverage

- **All new features** must include tests
- **Bug fixes** should include regression tests
- Aim for **80%+ code coverage** for new code
- Test both success and error cases

### Testing Framework

FuncDock uses:

- **Jest** - Test runner and assertions
- **Nock** - HTTP request mocking
- **Docker** - Production-parity testing

### Writing Tests

**Test File Structure:**

```javascript
// handler.test.mjs
import { testHandler, expectStatus, nock } from '../../test/setup.mjs';
import handler from './handler.js';

describe('Handler Name', () => {
  describe('Feature/Route', () => {
    it('should handle success case', async () => {
      const { res } = await testHandler(handler, {
        method: 'GET',
        query: { id: '123' },
      });

      expectStatus(res, 200);
      expect(res.body).toMatchObject({ success: true });
    });

    it('should handle error case', async () => {
      // Test error scenarios
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run function tests only
npm run test:functions

# Test in Docker (production parity)
funcdock test my-function --docker
```

### Test Checklist

- [ ] All new code has corresponding tests
- [ ] Tests pass locally (`npm test`)
- [ ] Tests pass in Docker environment
- [ ] Coverage meets minimum threshold
- [ ] Error cases are tested
- [ ] Edge cases are considered

---

## Branch Naming

Use descriptive branch names that indicate the type of change:

**Format:** `{type}/{short-description}`

**Types:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/improvements
- `chore/` - Maintenance tasks

**Examples:**

```bash
feature/add-layer-support
fix/cron-handler-error-handling
docs/update-deployment-guide
refactor/improve-logging
test/add-integration-tests
```

---

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Format:** `{type}({scope}): {description}`

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Test additions/changes
- `chore` - Maintenance tasks
- `perf` - Performance improvements

**Examples:**

```
feat(layers): add support for shared dependencies
fix(cron): handle missing cron job name gracefully
docs(deployment): update OAuth setup instructions
test(handlers): add integration tests for webhook handlers
refactor(logger): improve structured logging
```

**Commit Message Best Practices:**

- Use imperative mood ("add" not "added" or "adds")
- Keep first line under 72 characters
- Add detailed description in body if needed
- Reference issues with `Closes #123` or `Fixes #456`

---

## Pull Request Process

### Before Submitting

1. **Update your branch**

   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Run tests and linting**

   ```bash
   npm test
   npm run test:coverage
   ```

3. **Update documentation**
   - Update relevant README files
   - Add examples if introducing new features
   - Update API documentation if needed

### PR Checklist

- [ ] Code follows style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] Commit messages follow guidelines
- [ ] Branch is up to date with `main`
- [ ] No merge conflicts
- [ ] PR description is clear and complete

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## Testing

- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Tested in Docker environment

## Related Issues

Closes #123
Fixes #456

## Screenshots (if applicable)

Add screenshots for UI changes

## Additional Notes

Any additional information for reviewers
```

### Review Process

1. **Automated Checks** - CI will run tests and checks
2. **Code Review** - Maintainers will review your code
3. **Feedback** - Address any requested changes
4. **Approval** - Once approved, your PR will be merged

**Responding to Feedback:**

- Be open to suggestions
- Ask questions if something is unclear
- Make requested changes promptly
- Keep discussions constructive

---

## Reporting Issues

### Before Reporting

1. **Check existing issues** - Your issue might already be reported
2. **Search documentation** - The solution might be documented
3. **Try troubleshooting** - Check [TROUBLESHOOTING_README.md](TROUBLESHOOTING_README.md)

### Bug Reports

**Include:**

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Relevant logs or error messages
- Minimal reproduction case if possible

**Template:**

```markdown
## Description

Brief description of the bug

## Steps to Reproduce

1. Step one
2. Step two
3. See error

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- Node.js version:
- OS:
- FuncDock version:

## Logs/Errors

Paste relevant logs or error messages

## Additional Context

Any other relevant information
```

### Feature Requests

**Include:**

- Clear description of the feature
- Use case and motivation
- Proposed implementation (if you have ideas)
- Examples of similar features (if applicable)

---

## Code of Conduct

### Our Standards

**Be Respectful:**

- Use welcoming and inclusive language
- Respect different viewpoints and experiences
- Accept constructive criticism gracefully

**Be Professional:**

- Focus on what is best for the community
- Show empathy towards other community members
- Be patient with newcomers

**Be Constructive:**

- Provide helpful feedback
- Suggest improvements, not just point out problems
- Celebrate others' contributions

### Unacceptable Behavior

- Harassment or discriminatory language
- Personal attacks or trolling
- Publishing others' private information
- Other conduct that could reasonably be considered inappropriate

### Enforcement

Violations may result in warnings, temporary bans, or permanent bans from the project.

---

## License

By contributing to FuncDock, you agree that your contributions will be licensed under the MIT License. See [LICENSE](../LICENSE) for details.

---

## Getting Help

- **Documentation** - Check the [docs](.) directory
- **Issues** - Search or create GitHub issues
- **Discussions** - Use GitHub Discussions for questions

Thank you for contributing to FuncDock! 🚀
