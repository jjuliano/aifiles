# Contributing to AIFiles

Thank you for your interest in contributing to AIFiles! This document provides guidelines and information for contributors.

## 🌟 Ways to Contribute

- 🐛 **Report bugs** - Help us identify issues
- 💡 **Suggest features** - Share your ideas
- 📝 **Improve documentation** - Help others understand
- 💻 **Submit code** - Fix bugs or add features
- 🧪 **Test features** - Help ensure quality
- 🌍 **Translate** - Make AIFiles accessible worldwide

## 🚀 Getting Started

### Prerequisites

1. **Node.js** 18+ and **pnpm** 9+
2. **System dependencies**:
   ```bash
   # macOS
   brew install pandoc exiftool poppler csvkit

   # Linux
   sudo apt install pandoc exiftool poppler-utils python3-csvkit
   ```

3. **Optional for GUI development**:
   - Rust (for Tauri development)
   - ImageMagick (for icons)

### Setup Development Environment

1. **Fork and clone**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/aifiles.git
   cd aifiles
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up configuration**:
   ```bash
   cp .aifiles.sample ~/.aifiles
   cp .aifiles.json ~/.aifiles.json
   # Edit ~/.aifiles with your API keys
   ```

4. **Build the project**:
   ```bash
   pnpm build
   ```

5. **Run tests**:
   ```bash
   pnpm test
   pnpm type-check
   pnpm lint
   ```

## 📁 Project Structure

```
aifiles/
├── src/
│   ├── providers/          # LLM provider implementations
│   ├── cli.ts              # Main CLI
│   ├── cli-templates.ts    # Template management
│   ├── setup-wizard.ts     # Setup wizard
│   ├── folder-templates.ts # Template system
│   ├── file-watcher.ts     # File monitoring
│   ├── error-handler.ts    # Error handling
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Utility functions
├── src-tauri/              # Tauri GUI (Rust)
│   ├── src/                # Rust source files
│   │   ├── main.rs         # Application entry point
│   │   ├── commands.rs     # IPC command handlers
│   │   └── lib.rs          # Library exports
│   └── frontend/           # GUI interface
└── tests/                  # Test files (coming soon)
```

## 🐛 Reporting Bugs

### Before Reporting

1. Check [existing issues](https://github.com/jjuliano/aifiles/issues)
2. Try the latest version
3. Review [TESTING.md](TESTING.md) for troubleshooting

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Configure provider as...
2. Run command...
3. See error...

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., macOS 13.5]
- AIFiles version: [e.g., 2.0.0]
- LLM Provider: [e.g., OpenAI]
- Node version: [e.g., 18.17.0]

**Configuration**
```ini
# Paste relevant ~/.aifiles config (REDACT API KEYS!)
LLM_PROVIDER=openai
LLM_MODEL=gpt-3.5-turbo
```

**Error Messages**
```
Paste error messages here
```

**Screenshots**
If applicable, add screenshots
```

## 💡 Suggesting Features

### Feature Request Template

```markdown
**Feature Description**
Clear description of the feature

**Use Case**
How would this feature be used?
Who would benefit?

**Proposed Solution**
How might this work?

**Alternatives Considered**
What other approaches did you consider?

**Additional Context**
Any other relevant information
```

## 💻 Contributing Code

### Development Workflow

1. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

2. **Make changes**:
   - Write clear, concise code
   - Follow existing code style
   - Add comments for complex logic
   - Update types as needed

3. **Test your changes**:
   ```bash
   pnpm type-check  # TypeScript checks
   pnpm lint        # ESLint
   pnpm test        # Run tests
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   **Commit message format:**
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a pull request on GitHub.

### Code Style Guidelines

#### TypeScript
- Use TypeScript strict mode
- Define proper types/interfaces
- Avoid `any` type
- Export types for public APIs

```typescript
// Good
interface MyInterface {
  id: string;
  name: string;
}

function processData(data: MyInterface): void {
  // ...
}

// Bad
function processData(data: any) {
  // ...
}
```

#### Error Handling
- Use custom error classes from `error-handler.ts`
- Provide helpful error messages
- Include recovery suggestions

```typescript
// Good
throw new ConfigurationError(
  'OpenAI API key is required',
  { hint: 'Add OPENAI_API_KEY to ~/.aifiles' }
);

// Bad
throw new Error('missing key');
```

#### Async/Await
- Prefer async/await over promises
- Handle errors properly
- Use try/catch blocks

```typescript
// Good
async function processFile(path: string): Promise<void> {
  try {
    const content = await readFile(path);
    await analyzeContent(content);
  } catch (error) {
    handleError(error);
  }
}

// Bad
function processFile(path: string) {
  readFile(path).then(content => {
    analyzeContent(content);
  }).catch(err => console.log(err));
}
```

#### Naming Conventions
- `camelCase` for variables and functions
- `PascalCase` for classes and types
- `UPPER_SNAKE_CASE` for constants
- Descriptive names over short names

```typescript
// Good
const userConfiguration = getConfig();
class FileProcessor { }
const MAX_RETRIES = 3;

// Bad
const cfg = getConfig();
class fp { }
const max = 3;
```

### Adding a New LLM Provider

1. **Create provider file**:
   ```typescript
   // src/providers/newprovider-provider.ts
   import { LLMProvider } from './base-provider.js';

   export class NewProviderProvider implements LLMProvider {
     name = 'NewProvider';

     async sendMessage(prompt: string): Promise<string> {
       // Implementation
     }

     async analyzeImage?(imagePath: string, prompt: string): Promise<string> {
       // Optional vision support
     }

     async isAvailable(): Promise<boolean> {
       // Check availability
     }
   }
   ```

2. **Update factory**:
   ```typescript
   // src/providers/provider-factory.ts
   import { NewProviderProvider } from './newprovider-provider.js';

   export class ProviderFactory {
     static createProvider(config: LLMConfig): LLMProvider {
       switch (config.provider) {
         case 'newprovider':
           return new NewProviderProvider(config.apiKey);
         // ... other cases
       }
     }
   }
   ```

3. **Update types**:
   ```typescript
   // src/providers/base-provider.ts
   export interface LLMConfig {
     provider: 'openai' | 'grok' | 'ollama' | 'lmstudio' | 'newprovider';
     // ...
   }
   ```

4. **Update documentation**:
   - Add to README.md
   - Add to QUICKSTART.md
   - Update configuration examples

5. **Add tests** (when test suite exists)

### Adding a New File Type

1. **Update MIME types**:
   ```typescript
   // src/utils.ts
   export const categorizeFileByMimeType = (mimeType: string | null): string => {
     const newTypes = ['application/new-type'];
     if (newTypes.includes(mimeType)) {
       return 'NewCategory';
     }
     // ...
   }
   ```

2. **Add processing logic**:
   ```typescript
   case 'NewCategory': {
     content = await processNewFileType(filePath);
     format = String(config.NEWTYPE_FILENAME_FORMAT);
     mainDir = resolvePath(`${config.BASE_DIRECTORY}/${config.NEWTYPE_DIRECTORY}`);
     fileCase = String(config.NEWTYPE_FILE_NAME_CASE);
     break;
   }
   ```

3. **Update config schema**:
   - Add to `ConfigType`
   - Add to `.aifiles.sample`
   - Document in README

## 🧪 Testing Guidelines

### Manual Testing
1. Test with multiple providers (OpenAI, Ollama, etc.)
2. Test all file types
3. Test GUI functionality
4. Test template creation/management
5. Test file watching
6. Test error scenarios

### Automated Testing (Coming Soon)
```bash
pnpm test
```

### Before Submitting PR
- [ ] Code compiles without errors (`pnpm build`)
- [ ] TypeScript checks pass (`pnpm type-check`)
- [ ] Linter passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] Documentation updated
- [ ] Changelog updated (if applicable)

## 📝 Documentation

### Code Comments
- Use JSDoc for public functions
- Explain "why" not "what"
- Document complex algorithms

```typescript
/**
 * Analyzes file content using configured LLM provider
 * Falls back to EXIF metadata if analysis fails
 *
 * @param filePath - Absolute path to file
 * @param provider - LLM provider instance
 * @returns Analyzed content description
 * @throws {FileOperationError} If file cannot be read
 */
async function analyzeFile(filePath: string, provider: LLMProvider): Promise<string> {
  // ...
}
```

### README Updates
- Update relevant sections
- Add examples for new features
- Keep table of contents current

### Changelog
Follow [Keep a Changelog](https://keepachangelog.com/) format:
```markdown
## [Unreleased]
### Added
- New feature description

### Changed
- Changed behavior description

### Fixed
- Bug fix description
```

## 🔒 Security

### Reporting Security Issues
**Do NOT open public issues for security vulnerabilities.**

Email: security@aifiles.dev (or report privately on GitHub)

### Security Best Practices
- Never commit API keys
- Validate all user inputs
- Sanitize file paths
- Use parameterized queries
- Avoid `eval()` and similar functions

## 📋 Pull Request Process

1. **Fill out PR template completely**
2. **Link related issues** (#123)
3. **Describe changes** clearly
4. **Add tests** (when available)
5. **Update documentation**
6. **Request review** from maintainers

### PR Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added to complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Changelog updated

## 🏷️ Versioning

We use [Semantic Versioning](https://semver.org/):
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Communication

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas, general discussion
- **Pull Requests**: Code contributions

## 🙏 Recognition

Contributors will be:
- Added to CONTRIBUTORS.md
- Mentioned in release notes
- Credited in commit history

## ❓ Questions?

- Read the [documentation](README.md)
- Check [existing issues](https://github.com/jjuliano/aifiles/issues)
- Ask in [GitHub Discussions](https://github.com/jjuliano/aifiles/discussions)

## 📚 Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

Thank you for contributing to AIFiles! 🎉

Every contribution, no matter how small, makes a difference.
