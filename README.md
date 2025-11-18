<div align="center">
  <div>
    <img src=".github/screencapture.gif" alt="AIFiles"/>
    <h1 align="center">🤖 AIFiles</h1>
  </div>
	<p>A powerful CLI application that helps you organize and manage your files using AI.</p>
	<a href="https://www.npmjs.com/package/aifiles"><img
src="https://img.shields.io/npm/v/aifiles" alt="Current version"></a>
</div>

⚠️ This app uses cloud-based AI models 🤖, which may raise privacy concerns. Please be cautious when sharing personal information, or use a local LLM for increased privacy. 🔒

## ✨ What's New in Version 2.0

- **🎨 Enhanced TUI Experience**: Beautiful terminal user interface with interactive prompts
- **🌐 Multiple AI Provider Support**: Choose from ChatGPT, Grok, DeepSeek, or local LLMs (Ollama, LM Studio)
- **⚡ Improved CLI Features**: Dry-run mode, force mode, verbose output, and batch processing
- **👀 File Watching Daemon**: `aifiles watch` command for continuous file monitoring
- **📁 XDG Folder Templates**: Automatic templates for standard folders (Documents, Downloads, Pictures, etc.)
- **🎛️ Interactive Template Manager**: User-friendly interface for managing folder templates
- **⚡ Auto-Organize Mode**: Set folders to automatically organize files without prompts

# Installation

## Installation

To install AIFiles, simply run:

```bash
npm install -g aifiles
```

## Build from Source

```bash
git clone https://github.com/jjuliano/aifiles.git
cd aifiles
npm install
npm run build
```

For development:

```bash
npm run build
# Then test with:
node dist/cli.mjs <file-path>
```

## System Dependencies

For full functionality, you may want to install these optional system tools:

- [Pandoc](https://pandoc.org/) - For document processing
- [ExifTool](https://exiftool.org/) - For image metadata extraction
- [Poppler](https://poppler.freedesktop.org/) (pdftotext) - For PDF text extraction
- [csvkit](https://csvkit.readthedocs.io/) - For CSV processing

**MacOS (via Homebrew):**
```bash
brew install pandoc exiftool poppler csvkit
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install pandoc exiftool poppler-utils python3-csvkit
```

**Windows (via Chocolatey):**
```bash
choco install pandoc exiftool poppler csvkit
```

# Configuration

Copy the configuration files to your home directory:

```bash
git clone https://github.com/jjuliano/aifiles.git
cd aifiles
mkdir -p ~/.aifiles
cp .aifiles.sample ~/.aifiles/config
cp fields.json.sample ~/.aifiles/fields.json
```

Edit `~/.aifiles/config` to configure your AI provider:

```ini
# LLM Provider (openai, grok, deepseek, ollama, lmstudio)
LLM_PROVIDER=openai

# OpenAI API key (for OpenAI provider)
OPENAI_API_KEY=your_openai_key_here

# Grok API key (for Grok provider)
GROK_API_KEY=your_grok_key_here

# DeepSeek API key (for DeepSeek provider)
DEEPSEEK_API_KEY=your_deepseek_key_here

# LLM Model name
LLM_MODEL=gpt-3.5-turbo

# LLM Base URL (for Ollama or LM Studio)
LLM_BASE_URL=http://127.0.0.1:11434
```

### Vision/Image Analysis Support

AIFiles automatically uses vision capabilities for image files when available:

- **OpenAI**: Uses GPT-4 Vision API for image captioning
- **Ollama**: Uses LLaVA model (`ollama pull llava`)
- **Fallback**: Uses EXIF metadata if vision not available

## Using Local LLMs

### Ollama

1. Install [Ollama](https://ollama.ai/)
2. Pull a text model: `ollama pull llama3.2`
3. (Optional) Pull vision model for image analysis: `ollama pull llava`
4. Configure in `~/.aifiles/config`:
   ```ini
   LLM_PROVIDER=ollama
   LLM_MODEL=llama3.2
   LLM_BASE_URL=http://127.0.0.1:11434
   ```

### LM Studio

1. Install [LM Studio](https://lmstudio.ai/)
2. Start the local server
3. Configure in `~/.aifiles/config`:
   ```ini
   LLM_PROVIDER=lmstudio
   LLM_MODEL=local-model
   LLM_BASE_URL=http://127.0.0.1:1234/v1
   ```

# Usage

## CLI Commands

AIFiles provides multiple command-line tools:

### `aifiles` - Organize Files

Process a single file with various options:

```bash
# Basic usage
aifiles document.pdf

# Preview changes without applying them
aifiles document.pdf --dry-run

# Skip confirmation prompts
aifiles document.pdf --force

# Show detailed output
aifiles document.pdf --verbose

# Start file watching daemon
aifiles watch

# Browse and manage organized files
aifiles filemanager

# Get help
aifiles --help
```

### `aifiles-setup` - Setup Wizard

Run the interactive setup wizard:

```bash
aifiles-setup
```

This will guide you through:
- Checking system dependencies
- Choosing an AI provider
- Configuring API keys
- Setting up directories

### `aifiles-templates` - Manage Templates

Manage folder templates with various options:

```bash
# List all templates
aifiles-templates list

# Interactive menu for all template operations
aifiles-templates menu
# or
aifiles-templates --interactive

# Add a new template (interactive)
aifiles-templates add

# Edit an existing template
aifiles-templates edit <template-id>

# Remove a template
aifiles-templates remove <template-id>

# Enable watching for a template
aifiles-templates enable <template-id>

# Disable watching
aifiles-templates disable <template-id>

# Get help
aifiles-templates --help
```

### `aifiles watch` - File Watching Daemon

Start a persistent daemon that monitors enabled templates for new files:

```bash
aifiles watch
```

Features:
- **Real-time monitoring**: Detects new files as they're added
- **Auto-organization**: Automatically organizes files based on templates
- **Persistent running**: Runs continuously until stopped (Ctrl+C)
- **Multi-template support**: Monitors all enabled templates simultaneously
- **Graceful shutdown**: Properly stops all watchers on exit

**Example output:**
```
👀 AIFiles Watch Daemon
Monitoring enabled templates for file changes...

📁 Watching Templates:
  • Downloads (~/Downloads)
  • Pictures (~/Pictures)

📄 New file detected: report.pdf
   Template: Documents
   🤖 Auto-organizing...
   ✓ Organized to: ~/Documents/Work/Quarterly Report--2025-11-05/report.pdf

✅ Watch daemon started successfully!
💡 Press Ctrl+C to stop watching
```

### `aifiles filemanager` - File Management Interface

Browse, search, and manage all your organized files with a comprehensive TUI:

```bash
aifiles filemanager
```

**Features:**
- **📄 File Browser**: View all organized files with metadata
- **🔍 Search**: Find files by title, category, tags, or filename
- **✏️ Edit Organization**: Modify file titles, categories, and summaries
- **↩️ Version Control**: Revert files to previous versions
- **🔄 Re-analysis**: Re-analyze files with custom AI prompts
- **📊 Statistics**: View organization statistics and activity
- **🗑️ Database Management**: Delete file records when needed

**Interactive Features:**
- View detailed file information and version history
- Edit file metadata without re-organizing
- Revert to any previous version of organization
- Re-analyze with custom prompts for different results
- Search across all organized files
- Comprehensive statistics and analytics

**Configuration:**
Configure file manager behavior in `~/.aifiles/config`:

```ini
# File Manager Indexing Mode
# 'launch' - Index all files at startup (thorough but slower startup)
# 'on-demand' - Index folders when expanded (default, faster startup)
FILE_MANAGER_INDEX_MODE=on-demand
```

## Customizing AI Field Extraction

AIFiles uses a field definition system in `~/.aifiles/fields.json`. This file defines **what information** the AI should extract from your files and **how to use it** for file naming/organization.

**Important:** `fields.json` is NOT the actual LLM prompt. It contains **field definitions** that tell the AI what data to extract. These definitions get injected into the actual LLM prompt template (see `ORGANIZATION_PROMPT_TEMPLATE` below).

### Required Field Definitions

These field definitions are required for file organization:

```json
{
  "internal_file_title": "A descriptive title for the file based on its content.",
  "internal_file_category": "The primary category that best describes the file content.",
  "internal_file_summary": "A brief summary or abstract of the contents of the file.",
  "internal_file_tags": "A list of keywords or tags associated with the file."
}
```

### Available Field Placeholders

You can use over 100 field placeholders in your folder templates. These placeholders define what information the AI should extract:

**General File Fields:**
- `{file_title}` - File title
- `{file_category}` - General category
- `{file_category_1}`, `{file_category_2}`, `{file_category_3}` - Multi-level categories
- `{file_tags}` - Keywords/tags
- `{file_summary}` - Brief summary
- `{file_author}` - Author name
- `{file_date_created}` - Creation date

**Music-Specific Fields:**
- `{music_artist}` - Artist name
- `{music_album}` - Album title
- `{music_track_title}` - Song title
- `{music_track_number}` - Track number
- `{music_genre}` - Music genre
- `{music_year}` - Release year

**Picture-Specific Fields:**
- `{picture_date_taken}` - Photo date
- `{picture_location_taken}` - Location
- `{picture_photographer_name}` - Photographer

**Video-Specific Fields:**
- `{video_title}` - Video title
- `{video_director}` - Director name
- `{video_duration}` - Duration
- `{video_resolution}` - Resolution

**Document-Specific Fields:**
- `{document_page_count}` - Number of pages
- `{document_related}` - Related documents

[See full list in fields.json.sample](./fields.json.sample)

### Customizing Field Definitions

Edit `~/.aifiles/fields.json` to customize what information the AI should extract for each field:

```json
{
  "file_title": "Extract a SHORT, descriptive title (max 5 words)",
  "file_category_1": "Classify into: Work, Personal, Finance, or Education",
  "music_genre": "Identify the PRIMARY music genre only"
}
```

These field definitions get injected into the LLM prompt to tell the AI what data to extract.

### Timeout Configuration

Control how long to wait for AI analysis in `~/.aifiles/config`:

```ini
# Organization Timeout (in seconds)
# Default: 180 (3 minutes)
# Increase for slow AI models or network connections
ORGANIZATION_TIMEOUT=300
```

### Customizing Actual LLM Prompts

You can customize the **actual prompts sent to the LLM** in `~/.aifiles/config`:

#### 1. Main Organization Prompt Template

The master prompt template for file organization. The `{additionalPrompts}` placeholder gets replaced with field definitions from `fields.json`:

```ini
# Custom template for main file organization (used by CLI)
# Available placeholders: {fileName}, {fileContent}, {exifMetadata}, {mimeType}, {mimeCategory}, {additionalPrompts}
# The {additionalPrompts} placeholder contains all field definitions from ~/.aifiles/fields.json
ORGANIZATION_PROMPT_TEMPLATE="Analyze the file '{fileName}' (type: {mimeType}) with content: {fileContent}. Extract all information according to these prompts: {additionalPrompts}. Return ONLY valid JSON."
```

**How it works:**
1. Field definitions from `fields.json` → combined into `{additionalPrompts}`
2. Template + placeholders → final LLM prompt
3. LLM analyzes file → returns JSON with extracted data

#### 2. Simple Analysis Prompts

For quick file analysis without full organization:

```ini
# Custom prompt for re-analyzing files in file manager (F6)
REANALYZE_PROMPT="Analyze this document and provide: 1. A SHORT title (max 5 words) 2. ONE primary category 3. Exactly 3 tags 4. One sentence summary. Return as JSON with keys: title, category, tags, summary"

# Custom prompt for watch mode file analysis
WATCH_MODE_PROMPT="Quick analysis: Extract title, category, 3 tags, and summary. Return as JSON with keys: title, category, tags, summary"
```

#### 3. Image Caption Prompt (Vision AI)

For image/photo file analysis using vision-capable models:

```ini
# Custom prompt for image caption generation
IMAGE_CAPTION_PROMPT="Describe this image in detail, focusing on the main subject, setting, and any important visual elements. Be concise but descriptive."
```

**Vision Models Supported:**
- OpenAI: GPT-4 Vision, GPT-4o
- Ollama: llava, bakllava
- LM Studio: Compatible vision models
- Grok: Vision-enabled models

### JSON Response Enforcement

**All organization prompts automatically include this instruction:**

```
"Respond only with valid JSON containing exactly these fields: [field_list].

IMPORTANT:
- Start your response with { and end with }
- Do not write an introduction or summary
- Do not wrap the JSON in quotes or markdown code blocks
- Return ONLY the JSON object, nothing else"
```

Where `[field_list]` is dynamically generated based on the fields in your template (e.g., `internal_file_title, internal_file_category, internal_file_summary, internal_file_tags, file_author, music_artist`, etc.).

**Example:** If your template uses `{file_title}`, `{file_category}`, and `{music_artist}`, the instruction will be:
```
"Respond only with valid JSON containing exactly these fields: file_title, file_category, music_artist, internal_file_title, internal_file_category, internal_file_summary, internal_file_tags.

IMPORTANT:
- Start your response with { and end with }
- Do not write an introduction or summary
- Do not wrap the JSON in quotes or markdown code blocks
- Return ONLY the JSON object, nothing else"
```

This ensures the AI returns pure JSON with:
- ✅ Exactly the fields requested (no more, no less)
- ✅ No preambles or introductions
- ✅ No explanations or commentary
- ✅ No markdown code blocks
- ✅ No extraneous text

This prevents parsing errors and ensures consistent behavior across all AI providers.

**LLM Prompt Types (in `~/.aifiles/config`):**
- **ORGANIZATION_PROMPT_TEMPLATE**: Master prompt template for full file organization
  - Receives `{additionalPrompts}` = all field definitions from `fields.json`
  - Automatically appends JSON-only instruction
- **REANALYZE_PROMPT**: Simple analysis prompt for file manager (F6 key)
- **WATCH_MODE_PROMPT**: Simple analysis prompt for watch mode auto-organization
- **IMAGE_CAPTION_PROMPT**: Image description prompt for vision-capable AI models

**Field Definitions (in `~/.aifiles/fields.json`):**
- NOT actual LLM prompts, but field extraction instructions
- Define what data to extract: `file_title`, `music_artist`, `picture_date_taken`, etc.
- Get injected into `{additionalPrompts}` placeholder in the organization template

**Hierarchy:**
```
1. fields.json defines: "What fields to extract?"
   ↓
2. ORGANIZATION_PROMPT_TEMPLATE wraps: "How to ask the LLM?"
   ↓
3. Final LLM prompt sent to AI for analysis
```

## Folder Templates

Templates allow you to define custom folder structures and naming conventions for different types of files.

### Creating Folder Templates

Use the interactive template manager:

```bash
aifiles-templates menu
```

Or create templates directly:

```bash
aifiles-templates add
```

When creating a template, configure:
   - **Name**: A descriptive name (e.g., "Work Documents")
   - **Description**: What this template is for
   - **Base Path**: Where files will be organized (e.g., `~/Documents/Work`)
   - **Naming Structure**: Pattern using placeholders like `{file_category_1}/{file_title}`
   - **File Name Case**: Choose from snake_case, kebab-case, camelCase, etc.
   - **Auto-organize**: Enable to organize files automatically without prompts
   - **Watch for changes**: Enable to monitor this folder for new files

### File Watching

When file watching is enabled for a template:
- New files are detected automatically
- You receive a desktop notification
- If auto-organize is enabled, files are organized immediately
- Otherwise, you're prompted to review and approve the organization

# Features

## Core Features

- **🤖 Multiple AI Providers**: Choose from OpenAI ChatGPT, Grok, or local LLMs (Ollama, LM Studio)
- **📂 Smart File Organization**: Automatically categorize and organize files by content
- **🏷️ Metadata Extraction**: Extract and apply tags, comments, and metadata
- **📋 Folder Templates**: Create reusable folder structures with custom naming patterns
- **👁️ File Watching**: Monitor folders and detect new files in real-time
- **⚡ Auto-Organize Mode**: Set folders to organize files automatically
- **🎨 Customizable Naming**: Use various naming conventions (snake_case, kebab-case, camelCase, etc.)

## Supported File Types

- **📄 Documents**: PDF, Word, Excel, PowerPoint, text files, markdown
- **🎵 Music**: MP3, WAV, FLAC with metadata extraction
- **🖼️ Pictures**: JPEG, PNG, GIF with AI captioning
- **🎬 Videos**: MP4, AVI, MOV with metadata extraction
- **📦 Archives**: ZIP, RAR, 7z, TAR, GZIP
- **📁 Others**: Any other file type with EXIF metadata support

# Examples

## CLI Example

```bash
aifiles ~/Downloads/document.pdf
```

The AI will analyze the document and suggest:
- Category structure (e.g., `Work/Reports`)
- Meaningful filename based on content
- Relevant tags
- Summary for file comments

## Default XDG Templates

AIFiles automatically creates these templates for standard XDG folders when you first run any command:

### Documents Template
```
Name: Documents
Base Path: ~/Documents
Naming Structure: {file_category_1}/{file_title}--{file_date_created}
File Name Case: snake_case
Auto-organize: No
Watch for changes: No
```

### Downloads Template
```
Name: Downloads
Base Path: ~/Downloads
Naming Structure: {file_category_1}/{file_title}
File Name Case: kebab-case
Auto-organize: Yes
Watch for changes: Yes
```

### Pictures Template
```
Name: Pictures
Base Path: ~/Pictures
Naming Structure: {picture_date_taken}/{file_title}
File Name Case: lower_snake
Auto-organize: Yes
Watch for changes: Yes
```

### Music Template
```
Name: Music
Base Path: ~/Music
Naming Structure: {music_artist}/{music_album}/{file_title}
File Name Case: snake_case
Auto-organize: Yes
Watch for changes: No
```

### Videos Template
```
Name: Videos
Base Path: ~/Videos
Naming Structure: {file_category_1}/{file_date_created}/{file_title}
File Name Case: kebab-case
Auto-organize: Yes
Watch for changes: No
```

### Desktop Template
```
Name: Desktop
Base Path: ~/Desktop
Naming Structure: {file_category_1}/{file_title}
File Name Case: camelCase
Auto-organize: Yes
Watch for changes: Yes
```

# Naming Structure Placeholders

Use these placeholders in your folder templates:

- `{file_title}` - AI-generated file title
- `{file_category_1}` - Top-level category
- `{file_category_2}` - Sub-category
- `{file_category_3}` - Third-level category
- `{file_date_created}` - File creation date
- `{file_author}` - Document author
- `{music_artist}` - Music artist name
- `{music_album}` - Album name
- `{music_track_number}` - Track number
- `{picture_date_taken}` - Photo date

[See full list of 100+ placeholders in fields.json.sample](./fields.json.sample)

See [Customizing AI Field Extraction](#customizing-ai-field-extraction) section above for details on how to customize these.

# Roadmap

- [ ] Cloud storage integration (Dropbox, Google Drive, OneDrive)
- [ ] Batch processing improvements
- [ ] Custom AI prompts per template
- [ ] Multi-language support
- [ ] Plugin system for custom processors
- [ ] Mobile companion app

# Documentation

- 📖 [Quick Start Guide](QUICKSTART.md) - Get started in 5 minutes
- 🧪 [Testing Guide](TESTING.md) - Comprehensive testing
- 🔌 [API Documentation](API.md) - Extend AIFiles
- 🤝 [Contributing Guide](CONTRIBUTING.md) - How to contribute
- 🔒 [Security Policy](SECURITY.md) - Security best practices
- 📋 [Code of Conduct](CODE_OF_CONDUCT.md) - Community guidelines
- 📝 [Changelog](CHANGELOG.md) - Version history

# Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- How to report bugs
- How to suggest features
- How to submit pull requests
- Code style guidelines
- Development workflow

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

# License

This project is licensed under the MIT License.

