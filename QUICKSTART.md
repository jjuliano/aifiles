# Quick Start Guide

This guide will help you get started with AIFiles in 5 minutes.

## Step 1: Install AIFiles

### Option A: CLI Only
```bash
npm install -g aifiles
```


## Step 2: Install System Dependencies

**MacOS:**
```bash
brew install pandoc exiftool poppler csvkit
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install pandoc exiftool poppler-utils python3-csvkit
```

**Windows:**
```bash
choco install pandoc exiftool poppler csvkit
```

## Step 3: Configure Your AI Provider

### Using ChatGPT (Recommended for beginners)

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Create config file:
   ```bash
   mkdir -p ~/.aifiles
   curl -o ~/.aifiles/config https://raw.githubusercontent.com/jjuliano/aifiles/main/.aifiles.sample
   curl -o ~/.aifiles/prompts.json https://raw.githubusercontent.com/jjuliano/aifiles/main/prompts.json.sample
   ```
3. Edit `~/.aifiles` and add your key:
   ```ini
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-your-key-here
   ```

### Using Local LLM (Free, Private)

1. Install [Ollama](https://ollama.ai/)
2. Pull a model:
   ```bash
   ollama pull llama3.2
   ```
3. Configure:
   ```ini
   LLM_PROVIDER=ollama
   LLM_MODEL=llama3.2
   LLM_BASE_URL=http://127.0.0.1:11434
   ```

### Using Grok

1. Get API key from [X.AI](https://x.ai/)
2. Configure:
   ```ini
   LLM_PROVIDER=grok
   GROK_API_KEY=your-grok-key-here
   LLM_MODEL=grok-beta
   ```

## Step 4: Try It Out!

### CLI

Organize a single file:
```bash
aifiles ~/Downloads/document.pdf
```

The AI will:
1. Analyze the file content
2. Suggest a category and filename
3. Ask for your confirmation
4. Move and organize the file

### CLI

1. Create a template for downloads:
   ```bash
   aifiles-templates add
   # Follow prompts:
   # Name: My Downloads
   # Base Path: ~/Downloads/Organized
   # Naming: {file_category_1}/{file_title}
   # Case: kebab-case
   # Auto-organize: Yes
   # Watch changes: Yes
   ```

2. Drop a file into `~/Downloads/Organized`:
   ```bash
   cp ~/some-file.pdf ~/Downloads/Organized/
   ```

3. The file gets automatically organized!

## Step 5: Start the Watch Daemon

For continuous file monitoring, start the watch daemon:

```bash
aifiles watch
```

This will:
- Monitor all enabled templates continuously
- Auto-organize files as they're added
- Show real-time notifications
- Run in the background until stopped (Ctrl+C)

## Step 6: Browse Your Organized Files with File Manager

Use the file manager interface to browse and manage all your organized files:

```bash
aifiles filemanager
```

Features:
- View all organized files with metadata
- Search files by title, category, or tags
- Edit file organization without re-processing
- Revert to previous versions
- Re-analyze with custom prompts
- View statistics and activity

## Step 7: Create Your First Automation

### Scenario: Auto-organize screenshots

1. Create a screenshots template:
   ```bash
   aifiles-templates add
   # Name: Screenshots
   # Description: Organize screenshots by date
   # Base Path: ~/Pictures/Screenshots
   # Naming: {picture_date_taken}/{file_title}
   # Case: lower_snake
   # Auto-organize: Yes
   # Watch changes: Yes
   ```

2. Done! Now any screenshot saved to that folder is automatically organized

## Common Use Cases

### 1. Work Documents
```
Base Path: ~/Documents/Work
Naming: {file_category_1}/{file_category_2}/{file_title}--{file_date_created}
Watch: Yes | Auto: No (review before organizing)
```

### 2. Photo Library
```
Base Path: ~/Pictures/Library
Naming: {picture_date_taken}/{file_title}
Watch: Yes | Auto: Yes
```

### 3. Music Collection
```
Base Path: ~/Music/Library
Naming: {music_artist}/{music_album}/{music_track_number}--{music_track_title}
Watch: Yes | Auto: Yes
```

### 4. Downloads Cleanup
```
Base Path: ~/Downloads/Sorted
Naming: {file_category_1}/{file_title}
Watch: Yes | Auto: Yes
```

## Tips

- **Start with auto-organize OFF** to see how AI categorizes files
- **Use meaningful base paths** that match your workflow
- **Combine multiple templates** for different file types
- **Check notifications** to learn AI's categorization patterns
- **Adjust naming structures** after seeing initial results

## Troubleshooting

### "API key not found"
- Check `~/.aifiles` has correct key
- Verify environment variables if using them

### "File not found" error
- Ensure system dependencies are installed
- Check file permissions

### Template watching not working
- Verify template has "Watch for changes" enabled: `aifiles-templates list`
- Check base path exists and is accessible
- Test manually: `aifiles-templates enable <template-id>`

## Next Steps

- Explore the [full README](README.md) for advanced features
- Check out [configuration examples](.aifiles.sample)
- Join discussions on [GitHub](https://github.com/jjuliano/aifiles/discussions)

Happy organizing! 🎉
