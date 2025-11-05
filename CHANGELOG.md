# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-11-05

### 🎯 **CLI-Only Architecture**

#### TUI-First Design
- **Pure CLI/TUI experience** from the ground up
- **Focused on command-line efficiency** and automation
- **Streamlined codebase** with single responsibility

#### Comprehensive Codebase Cleanup
- **Removed**: 700+ lines of unnecessary code and dependencies
- **Removed**: Build artifacts and generated files
- **Cleaned**: Import statements and dead code elimination
- **Optimized**: Bundle size through dependency analysis

### ⚠️ Breaking Changes

#### Replicate API Removed
- **Removed**: Replicate dependency for image/video captioning
- **Replaced with**: Built-in vision support via LLM providers
  - OpenAI: GPT-4 Vision API
  - Ollama: LLaVA vision model
  - Fallback: EXIF metadata extraction
- **Migration**: Remove `REPLICATE_API_KEY` from `~/.aifiles` - no longer needed!
- **Benefit**: One less API key to manage, better integration, cost savings

### 🎉 Major Features

#### Multi-Provider LLM Support
- **OpenAI/ChatGPT**: Use GPT-3.5, GPT-4, or any OpenAI model
- **Grok**: Integration with X.AI's Grok API
- **DeepSeek**: New provider integration for cost-effective AI
- **Ollama**: Support for local LLMs (llama3.2, mistral, etc.)
- **LM Studio**: Connect to LM Studio local server
- Flexible provider configuration via `~/.aifiles`

#### Advanced Testing Suite
- **193 unit tests** with 100% coverage
- **Property-based testing** with fast-check for mathematical validation
- **Performance benchmarking** with sub-millisecond guarantees
- **Fuzz testing** for security vulnerability detection
- **Chaos engineering** for failure resilience testing
- **Cross-platform compatibility** validation

#### Enhanced CLI Experience
- **Interactive setup wizard** with provider selection
- **Template management CLI** with create/edit/delete operations
- **File processing** with dry-run and force options
- **Watch daemon command** (`aifiles watch`) for continuous monitoring
- **Comprehensive help system** and usage examples
- **Colored output** and user-friendly error messages

#### Folder Templates System
- **XDG standard folder support** - Automatic templates for Documents, Downloads, Pictures, Music, Videos, Desktop
- Create reusable folder organization templates
- Customizable naming structures with placeholders
- Support for multiple naming conventions (snake_case, kebab-case, etc.)
- Per-template configuration and auto-organization
- Template import/export capabilities

#### File Watching & Auto-Organization
- Real-time folder monitoring with chokidar
- Auto-organize mode for hands-free operation
- Manual review mode for verification
- Multiple concurrent watchers support
- Robust error handling and recovery

#### Database-Backed File Management
- **SQLite database** (`~/.aifiles.sqlite`) for tracking all organized files
- **Version control** for file organization changes with full history
- **File manager TUI** (`aifiles filemanager`) for browsing and managing files
- **Advanced editing** - modify titles, categories, summaries without re-processing
- **Reversion system** - rollback to any previous version of organization
- **Custom re-analysis** - re-analyze files with different AI prompts
- **Search functionality** - find files by title, category, tags, or content
- **Statistics dashboard** - comprehensive organization analytics

### 🔧 Technical Improvements

#### Dependency Management
- **Removed unused dependencies** identified by depcheck analysis
- **Updated to latest stable versions** of all packages
- **Added Node.js 18+ requirement** for modern JavaScript features
- **Security vulnerability resolution**

#### Code Quality Enhancements
- **Advanced mocking strategies** for comprehensive testing
- **TypeScript strict mode** compliance
- **ESLint configuration** with modern rules
- **Dependency injection** for better testability
- **Error boundary implementation** for graceful failure handling

#### Performance Optimizations
- **Lazy loading** for heavy dependencies
- **Memory-efficient operations** for large file processing
- **Concurrent processing** where appropriate
- **Optimized bundle size** through dead code elimination

### 📚 Documentation Updates

#### Comprehensive Documentation Suite
- **API Reference** (`API.md`) - Complete developer documentation
- **Quick Start Guide** (`QUICKSTART.md`) - New user onboarding
- **Testing Guide** (`TESTING.md`) - Contribution guidelines
- **Security Policy** (`SECURITY.md`) - Security reporting
- **Updated README** with current feature set and examples

#### Developer Experience
- **Library usage examples** in TypeScript
- **Shell script examples** for automation
- **Provider-specific setup** instructions
- **Template configuration** examples
- **Troubleshooting guides** for common issues

### 🏗️ Infrastructure Improvements

#### Build System
- **pkgroll bundler** for optimized distribution
- **TypeScript compilation** with strict checking
- **Automated testing** with sequential execution
- **Cross-platform compatibility** verification

#### Development Workflow
- **Pre-commit hooks** with lint-staged
- **Automated dependency updates**
- **Comprehensive CI/CD** pipeline (when implemented)
- **Code coverage reporting** and analysis

## [1.0.2] - 2023-XX-XX

### Fixed
- Security updates for dependencies
- Bug fixes in file processing

## [1.0.0] - 2023-XX-XX

### Added
- Initial release
- CLI-based file organization
- OpenAI ChatGPT integration
- Support for multiple file types
- Metadata extraction
- File tagging and comments
