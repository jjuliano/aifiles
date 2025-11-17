# Folder Structure Templates

AIFiles now supports importing and creating complete folder structures from template files! This is perfect for setting up consistent directory structures for media libraries, project organization, or any standardized file system layout.

## Quick Start

### 1. Create a Template from Folder Structure

```bash
# Interactive mode - will prompt for details
aifiles-templates create-from-structure
```

Or create directly:

```bash
# Using the example media library structure
aifiles-templates create-from-structure
# When prompted:
# - ID: media-library
# - Name: Media Library
# - Description: Complete media organization structure
# - Base path: ~/Media
# - Structure file: ./examples/media-library-structure.txt
```

### 2. Create the Folders

```bash
# This will create all folders from the template
aifiles-templates create-folders media-library
```

### 3. Use with Existing Template

You can also add folder structure to an existing template:

```bash
# Import folder structure into existing template
aifiles-templates import-structure downloads ./examples/media-library-structure.txt

# Then create the folders
aifiles-templates create-folders downloads
```

## Folder Structure File Format

The folder structure file is a simple text file with one folder path per line:

```
./archives
./archives/assets
./archives/backups
./audio
./audio/music
./audio/podcasts
./video
./video/movies
./video/tv-shows
```

**Format rules:**
- One folder path per line
- Paths should start with `./` (relative to base path)
- Empty lines are ignored
- Lines starting with `#` are treated as comments
- Forward slashes (/) for path separators

## Complete Workflow Example

### Step 1: Create your folder structure file

Create a file `my-structure.txt`:

```
./projects
./projects/active
./projects/archive
./documents
./documents/contracts
./documents/invoices
./resources
./resources/templates
./resources/assets
```

### Step 2: Create template with structure

```bash
aifiles-templates create-from-structure
```

Enter when prompted:
- **ID**: `work-projects`
- **Name**: Work Projects
- **Description**: Standard project organization structure
- **Base path**: `~/Work`
- **Structure file**: `./my-structure.txt`

### Step 3: Create the folders

```bash
aifiles-templates create-folders work-projects
```

This will create:
```
~/Work/
├── projects/
│   ├── active/
│   └── archive/
├── documents/
│   ├── contracts/
│   └── invoices/
└── resources/
    ├── templates/
    └── assets/
```

## Exporting and Sharing Templates

### Export a Template

```bash
# Export template with folder structure
aifiles-templates export media-library ./my-template.json
```

This creates a JSON file with:
- Template configuration
- Naming rules
- Complete folder structure
- All settings

### Import a Template

```bash
# Import on another system or share with team
aifiles-templates import-template ./my-template.json
```

### Share Your Templates

Templates are portable! Share the exported JSON file with:
- Team members (standardized project structure)
- Multiple machines (consistent organization)
- The community (helpful templates for others)

## Advanced Usage

### Combine with AI Organization

Templates with folder structures work seamlessly with AIFiles' AI-powered organization:

1. Create folder structure template
2. Enable auto-organize for the template
3. AIFiles will organize files into your custom structure

```bash
# Enable auto-organization
aifiles-templates enable work-projects
```

Now when you organize files, AIFiles will use your custom folder structure!

### Watch Mode with Custom Structure

```bash
# Create folders from template
aifiles-templates create-folders work-projects

# Enable watching
aifiles-templates enable work-projects

# Start watch daemon
aifiles watch ~/Work
```

Files added to ~/Work will be automatically organized into your custom folder structure!

## CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `create-from-structure` | Create new template with folder structure (interactive) |
| `import-structure <id> <file>` | Add folder structure to existing template |
| `create-folders <id>` | Create all folders from template |
| `export <id> <file>` | Export template to JSON file |
| `import-template <file>` | Import template from JSON file |

### Examples

```bash
# List all templates
aifiles-templates list

# Create template from structure
aifiles-templates create-from-structure

# Import structure into existing template
aifiles-templates import-structure documents ./my-folders.txt

# Create folders
aifiles-templates create-folders documents

# Export for sharing
aifiles-templates export documents ./doc-template.json

# Import on another machine
aifiles-templates import-template ./doc-template.json

# View all options
aifiles-templates --help
```

## Example: Media Library Structure

The included `media-library-structure.txt` provides a comprehensive media organization structure with:

### Audio
- Music (by artist/album)
- Audiobooks
- Podcasts
- Soundtracks (games/movies/TV)
- Sound effects

### Video
- Movies
- TV Shows
- Anime
- Web videos

### Images
- Photos (personal/friends/family)
- Artwork (digital/paintings/logos)
- Charts and diagrams
- Screenshots (by platform)
- Memes and wallpapers

### Games
- Video games (by platform)
- Tabletop games (board/card/RPG)
- Party and sport games

### Software
- Applications (by OS)
- Source code
- Scripts
- Firmware

### Documents and Archives

To use this structure:

```bash
aifiles-templates create-from-structure
# ID: media-library
# Name: Complete Media Library
# Description: Comprehensive media organization structure
# Base path: ~/Media
# Structure file: ./examples/media-library-structure.txt

aifiles-templates create-folders media-library
```

## Tips

1. **Start Small**: Begin with a basic structure and expand as needed
2. **Use Descriptive Names**: Make folder names clear and consistent
3. **Group Logically**: Organize by type, then by more specific categories
4. **Export Often**: Back up your templates by exporting them
5. **Share Useful Templates**: Help others by sharing your proven structures

## Troubleshooting

### "Template not found"
Make sure the template ID exists:
```bash
aifiles-templates list
```

### "Structure file not found"
Use absolute or relative path to your structure file:
```bash
aifiles-templates import-structure mytemplate /full/path/to/structure.txt
```

### "Folders already exist"
The command is safe - it will create only missing folders

## Integration with AI Organization

When AIFiles organizes a file:

1. Analyzes file content with AI
2. Determines category and metadata
3. Checks template folder structure
4. Places file in appropriate existing folder
5. Creates new folders if needed (following naming pattern)

Your custom folder structure provides the skeleton, and AIFiles fills it intelligently!

---

**Need help?** Run `aifiles-templates --help` or `aifiles --help`
