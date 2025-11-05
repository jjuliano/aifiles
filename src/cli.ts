import { green, lightCyan, red, blue, yellow, cyan } from "kolorist";
import { intro, outro, select, spinner, text, isCancel } from "@clack/prompts";
import { cli } from "cleye";
import { description, version } from "../package.json";

// Check for help flags before cleye processes them
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
${lightCyan("🤖 AIFiles v" + version)} - Organize your files with AI
${description}

${green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}

${green("USAGE")}
  aifiles <file-path> [options]          # Organize a single file
  aifiles <command> [options]            # Run a specific command

${green("FILE ORGANIZATION EXAMPLES")}
  aifiles document.pdf                   # Basic file organization
  aifiles photo.jpg --verbose            # Show detailed AI analysis
  aifiles report.docx --dry-run          # Preview changes without applying
  aifiles data.xlsx --force              # Skip confirmation prompts
  aifiles song.mp3 --verbose             # Process audio with metadata
  aifiles invoice.pdf --unattended       # Auto-organize without prompts

${green("AVAILABLE COMMANDS")}
  ${blue("aifiles-setup")}           Interactive setup wizard for configuration
  ${blue("aifiles-templates")}       Manage folder templates and organization rules
  ${blue("aifiles watch")}           Start daemon to monitor and auto-organize files
  ${blue("aifiles filemanager")}     Browse and manage all organized files
  ${yellow("--unattended")}          Run filemanager/watch in automated mode

${green("COMMAND LINE FLAGS")}
  ${yellow("-h, --help")}              Show this help message
  ${yellow("-d, --dry-run")}           Preview changes without making them
  ${yellow("-f, --force")}             Skip confirmation prompts
  ${yellow("-v, --verbose")}           Show detailed output and AI analysis
  ${yellow("-b, --batch")}             Process multiple files (non-interactive)
  ${yellow("-u, --unattended")}        Skip all prompts and auto-organize

${green("FILE TYPES SUPPORTED")}
  📄 Documents: PDF, DOCX, XLSX, TXT, MD, HTML
  🖼️  Images:    JPG, PNG, GIF, WEBP, TIFF (with AI vision analysis)
  🎵 Audio:      MP3, FLAC, WAV, M4A (with metadata extraction)
  🎬 Video:      MP4, MOV, AVI, MKV (with metadata + optional vision)
  📦 Archives:   ZIP, TAR, RAR (with content analysis)
  💾 Other:      Any file type (basic organization)

${green("AI PROVIDERS SUPPORTED")}
  🤖 ${blue("OpenAI")}          GPT-4 Vision, GPT-3.5 (API key required)
  🦙 ${blue("Ollama")}          Local LLMs (Llama2, Mistral, etc.)
  🐦 ${blue("Grok")}            xAI's Grok (API key required)
  🔍 ${blue("DeepSeek")}        Cost-effective alternative (API key required)
  💻 ${blue("LM Studio")}       Local server integration

${green("CONFIGURATION")}
  Config file: ~/.aifiles/config
  Templates:   ~/.aifiles/templates.json
  Database:    ~/.aifiles/database.sqlite (file tracking)

${green("QUICK START")}
  1. ${yellow("aifiles-setup")}           # Configure AI provider
  2. ${yellow("aifiles-templates add")}   # Create organization templates
  3. ${yellow("aifiles document.pdf")}    # Organize your first file
  4. ${yellow("aifiles filemanager")}     # Browse organized files
  5. ${yellow("aifiles watch")}           # Start auto-organization daemon
     ${yellow("aifiles filemanager --unattended")} # Run maintenance operations

${green("ADVANCED FEATURES")}
  • ${blue("Version Control")}     - Track file organization changes
  • ${blue("Template System")}     - Custom naming and folder structures
  • ${blue("File Watching")}       - Real-time auto-organization
  • ${blue("Batch Processing")}    - Handle multiple files efficiently
  • ${blue("Metadata Enhancement")} - Add tags and comments to files

${green("DOCUMENTATION")}
  📖 Quick Start:  https://github.com/jjuliano/aifiles#quick-start
  📚 Full Guide:   https://github.com/jjuliano/aifiles#readme
  🧪 Testing:      https://github.com/jjuliano/aifiles/blob/main/TESTING.md

${green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}
`);
  process.exit(0);
}

const argv = cli({
  name: "aifiles",

  version,
  parameters: ["[command]", "[file]"],
  flags: {
    dryRun: {
      type: Boolean,
      alias: "d",
      description: "Show what would be done without making changes",
    },
    force: {
      type: Boolean,
      alias: "f",
      description: "Skip confirmation prompts",
    },
    verbose: {
      type: Boolean,
      alias: "v",
      description: "Show detailed output",
    },
    batch: {
      type: Boolean,
      alias: "b",
      description: "Process multiple files (non-interactive)",
    },
    unattended: {
      type: Boolean,
      alias: "u",
      description: "Skip all interactive prompts and auto-organize",
    },
  },
});

// Create default config if it doesn't exist
await createDefaultConfig();

const config = await getConfig();

import {
  addTagsToFile,
  addCommentsToFile,
  askForContext,
  askForRevisionNumber,
  displayChanges,
  fileExists,
  generatePromptResponse,
  getConfig,
  createDefaultConfig,
  getPrompt,
  replacePromptKeys,
  resolvePath,
  separateFolderAndFile,
  parseJson,
  FileMetadataManager,
} from "./utils.js";
import { ProviderFactory } from "./providers/provider-factory.js";
import { LLMConfig } from "./providers/base-provider.js";
import { FileWatcher } from "./file-watcher.js";
import { FolderTemplateManager } from "./folder-templates.js";
import { FileDatabase } from "./database.js";
import { FileManager } from "./file-manager.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Handle watch command
if (argv._.command === 'watch') {
  await startWatchDaemon();
  // This will keep the process running
}

// Handle filemanager command
if (argv._.command === 'filemanager') {
  const fileManager = new FileManager();

  if (argv.flags.unattended) {
    // Run maintenance operations in unattended mode
    console.log(`${lightCyan("🔧 AIFiles FileManager - Unattended Mode")}`);
    console.log("Running file maintenance operations...\n");

    try {
      // Index files to update database
      console.log(`${yellow("📊")} Indexing files...`);
      await fileManager.indexFilesIfNeeded();
      console.log(`${green("✓")} File indexing complete`);

      // Load and verify discovered files
      console.log(`${yellow("🔍")} Verifying discovered files...`);
      await fileManager.loadFiles();
      console.log(`${green("✓")} File verification complete`);

      // Show summary stats
      console.log(`\n${green("📈 Summary:")}`);
      console.log(`   Organized files: ${(fileManager as any).files?.length || 0}`);
      console.log(`   Discovered files: ${(fileManager as any).discoveredFiles?.length || 0}`);

      console.log(`\n${green("✅")} Maintenance operations completed successfully!`);

    } catch (error) {
      console.error(`${red("❌")} Maintenance failed:`, error);
      process.exit(1);
    } finally {
      fileManager.close();
    }
    process.exit(0);
  } else {
    // Normal interactive mode
    try {
      await fileManager.showFileList();
    } finally {
      fileManager.close();
    }
    process.exit(0);
  }
}

// Watch daemon function
export async function startWatchDaemon(): Promise<void> {
  console.log(`${lightCyan("👀 AIFiles Watch Daemon")}`);
  console.log("Monitoring enabled templates for file changes...\n");

  const templateManager = new FolderTemplateManager();
  const fileWatcher = new FileWatcher();

  // Load all templates
  const templates = await templateManager.loadTemplates();

  // Find templates with watching enabled
  const watchableTemplates = templates.filter(template => template.watchForChanges);

  if (watchableTemplates.length === 0) {
    console.log(`${yellow("⚠️")} No templates have watching enabled.`);
    console.log(`Use ${green("aifiles-templates enable <template-id>")} to enable watching for templates.`);
    console.log(`Use ${green("aifiles-templates list")} to see available templates.\n`);
    process.exit(1);
  }

  console.log(`${green("📁 Watching Templates:")}`);
  watchableTemplates.forEach(template => {
    console.log(`  ${green("•")} ${template.name} (${template.basePath})`);
  });
  console.log();

  // Set up watchers for each enabled template
  for (const template of watchableTemplates) {
    try {
      await fileWatcher.watchTemplate(template);
      console.log(`${green("✓")} Watching: ${template.name} (${template.basePath})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`${red("✗")} Failed to watch: ${template.name} (${template.basePath}) - ${errorMessage}`);
    }
  }

  // Handle file events
  fileWatcher.on('fileAdded', async (event) => {
    const { filePath, template, fileName } = event;

    console.log(`${green("📄")} New file detected: ${fileName}`);
    console.log(`   Template: ${template.name}`);
    console.log(`   Path: ${filePath}`);

    // Auto-organize if enabled
    if (template.autoOrganize) {
      try {
        console.log(`   ${green("🤖")} Auto-organizing...`);

        // Process the file (similar to main file processing logic)
        const absolutePath = resolvePath(filePath);
        if (!await fileExists(absolutePath)) {
          console.log(`   ${red("✗")} File no longer exists: ${filePath}`);
          return;
        }

        // Get AI analysis using configured or default prompt
        const defaultWatchPrompt = `Analyze this file and provide:
1. A descriptive title
2. Main category
3. 3-5 relevant tags
4. Brief summary

Return as JSON with keys: title, category, tags, summary.

IMPORTANT:
- Start your response with { and end with }
- Include exactly these fields: title, category, tags, summary
- Do not write an introduction or summary
- Do not wrap the JSON in quotes or markdown code blocks
- Return ONLY the JSON object, nothing else`;

        const prompt = config.WATCH_MODE_PROMPT || defaultWatchPrompt;

        const response = await generatePromptResponse(config, prompt);
        if (!response) {
          console.log(`   ${red("✗")} Failed to get AI analysis`);
          return;
        }

        let analysis;
        try {
          analysis = await parseJson(response);
        } catch (parseError) {
          console.log(`   ${red("✗")} Failed to parse AI response as JSON`);
          console.log(`   ${yellow("⚠")} Response: ${response.substring(0, 100)}...`);
          return;
        }

        if (!analysis || typeof analysis !== 'object') {
          console.log(`   ${red("✗")} Invalid AI response format`);
          return;
        }

        // Apply template naming - use the full AI analysis for template replacement
        const folderName = await replacePromptKeys(
          template.namingStructure,
          {
            ...analysis,  // Include all fields from AI analysis
            file_date_created: new Date().toISOString().split('T')[0],  // Add current date
          },
          template.basePath,
          path.extname(fileName),
          template.fileNameCase || 'snake'
        );

        const newPath = path.dirname(folderName);
        const newFilePath = path.join(newPath, fileName);

        // Create directory and move file
        await fs.mkdir(newPath, { recursive: true });
        await fs.rename(absolutePath, newFilePath);

        console.log(`   ${green("✓")} Organized to: ${newFilePath}`);

        // Add tags and comments if supported
        if (config.ADD_FILE_TAGS && analysis.tags) {
          try {
            await addTagsToFile(newFilePath, analysis.tags);
          } catch (error) {
            console.log(`   ${yellow("⚠")} Could not add tags: ${error}`);
          }
        }

        if (config.ADD_FILE_COMMENTS && analysis.summary) {
          try {
            await addCommentsToFile(newFilePath, analysis.summary);
          } catch (error) {
            console.log(`   ${yellow("⚠")} Could not add comments: ${error}`);
          }
        }

        // Track file organization in database
        try {
          const db = new FileDatabase();
          const fileId = db.recordFileOrganization({
            originalPath: filePath,
            currentPath: newFilePath,
            originalName: fileName,
            currentName: path.basename(newFilePath),
            templateId: template.id,
            templateName: template.name,
            category: analysis.category || 'Others',
            title: analysis.title || fileName,
            tags: analysis.tags || [],
            summary: analysis.summary || '',
            aiProvider: config.LLM_PROVIDER || 'ollama',
            aiModel: config.LLM_MODEL || 'default',
            aiPrompt: prompt,
            aiResponse: JSON.stringify(analysis),
          });
          console.log(`   ${green("📊")} Tracked in database (ID: ${fileId})`);
          db.close();
        } catch (dbError) {
          console.log(`   ${yellow("⚠")} Could not track file in database: ${dbError}`);
        }

      } catch (error) {
        console.log(`   ${red("✗")} Auto-organization failed: ${error}`);
        console.error(error);
      }
    } else {
      console.log(`   ${yellow("⏳")} Manual review required (auto-organize disabled)`);
    }

    console.log();
  });

  fileWatcher.on('error', (event) => {
    console.log(`${red("❌")} Watcher error for ${event.template.name}: ${event.error}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n${yellow("🛑")} Shutting down file watchers...`);
    fileWatcher.stopAll();
    console.log(`${green("✓")} All watchers stopped. Goodbye!\n`);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log(`\n${yellow("🛑")} Received termination signal...`);
    fileWatcher.stopAll();
    process.exit(0);
  });

  console.log(`${green("✅")} Watch daemon started successfully!`);
  console.log(`${yellow("💡")} Press Ctrl+C to stop watching\n`);

  // Keep the process running
  return new Promise(() => {
    // This promise never resolves, keeping the process alive
  });
}

// Check if a file was provided
// If command looks like a file path, treat it as the file parameter
let targetFile = argv._.file;
if (!targetFile && argv._.command) {
  // Check if command looks like a file (contains extension or is a valid path)
  if (argv._.command.includes('.') || argv._.command.includes('/') || argv._.command.includes('\\')) {
    targetFile = argv._.command;
  }
}

if (!targetFile) {
  console.error(`${red("✖")} Error: No file specified. Please provide a file path to organize.`);
  console.log(`\nRun ${green("aifiles --help")} for usage information.`);
  console.log(`\nFor setup help: ${green("aifiles-setup")}`);
  console.log(`For template management: ${green("aifiles-templates")}`);
  process.exit(1);
}

// Validate provider and API keys
const provider = config.LLM_PROVIDER || 'ollama';

if (provider === 'openai') {
  const apiKey =
    process.env.OPENAI_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENAI_API_TOKEN ??
    config.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Please set your OpenAI API key in ~/.aifiles");
  }
  config.OPENAI_API_KEY = apiKey;
} else if (provider === 'grok') {
  const apiKey =
    process.env.GROK_KEY ??
    process.env.GROK_API_KEY ??
    config.GROK_API_KEY;

  if (!apiKey) {
    throw new Error("Please set your Grok API key in ~/.aifiles");
  }
  config.GROK_API_KEY = apiKey;
} else if (provider === 'deepseek') {
  const apiKey =
    process.env.DEEPSEEK_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    config.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("Please set your DeepSeek API key in ~/.aifiles");
  }
  config.DEEPSEEK_API_KEY = apiKey;
}

// Create LLM provider instance
let apiKey: string | undefined;
if (provider === 'openai') {
  apiKey = config.OPENAI_API_KEY;
} else if (provider === 'grok') {
  apiKey = config.GROK_API_KEY;
} else if (provider === 'deepseek') {
  apiKey = config.DEEPSEEK_API_KEY;
}

const llmConfig: LLMConfig = {
  provider,
  apiKey,
  model: config.LLM_MODEL,
  baseUrl: config.LLM_BASE_URL,
};

const llmProvider = ProviderFactory.createProvider(llmConfig);

// Check file exists before showing intro
const exists = await fileExists(targetFile);
if (!exists) {
  console.error(`${red("✖")} Error: File not found: ${targetFile}`);
  console.log(`\nRun ${green("aifiles --help")} for usage information.`);
  console.log(`\nFor setup help: ${green("aifiles-setup")}`);
  console.log(`For template management: ${green("aifiles-templates")}`);
  process.exit(1);
}

(async () => {
  intro(lightCyan(" aifiles "));

  let success = false;
  while (!success) {
    try {
      const target = targetFile;

      const detectingFiles = spinner();
      detectingFiles.start(`Detecting file: ${target}`);

      if (argv.flags.verbose) {
        console.log(`${green("✔")} File found: ${target}`);
      }

      const { prompt, format, mainDir, fileExt, fileCase } = await getPrompt(
        config,
        target,
        llmProvider,
        Number(config.MAX_CONTENT_WORDS)
      );
      detectingFiles.stop(`File ${target} ready for analysis!`);

      if (argv.flags.verbose) {
        console.log(`${green("✔")} Generated organization prompt for file type`);
      }

      const s = spinner();
      s.start("The AI is analyzing your file");
      const message = await generatePromptResponse(config, prompt);
      s.stop(`File analyzed!`);

      if (!message) {
        throw new Error('Failed to get AI response. Please check your LLM provider configuration.');
      }

      if (argv.flags.verbose) {
        console.log(`${green("✔")} AI analysis completed`);
      }

      // Add progress indicator for parsing
      const parseSpinner = spinner();
      parseSpinner.start("Parsing AI response...");
      
      let promptObj;
      try {
        promptObj = await parseJson(message);
        parseSpinner.stop("Response parsed!");
      } catch (parseError: any) {
        parseSpinner.stop("Parsing failed!");
        
        // Write full debug info to error file
        const errorLogPath = path.join(os.homedir(), '.aifiles', 'last-error.log');
        const errorDetails = `
${'='.repeat(100)}
JSON PARSING ERROR - ${new Date().toISOString()}
${'='.repeat(100)}

PROMPT SENT TO LLM:
${'-'.repeat(100)}
${prompt}
${'-'.repeat(100)}

RAW LLM RESPONSE (Length: ${message.length} chars):
${'-'.repeat(100)}
${message}
${'-'.repeat(100)}

PARSE ERROR:
${parseError.message}

PARSE ERROR STACK:
${parseError.stack || 'N/A'}

${'='.repeat(100)}
`;
        
        try {
          await fs.writeFile(errorLogPath, errorDetails, 'utf8');
        } catch (writeError) {
          // Ignore write errors
        }
        
        // Show summary in console
        console.error('\n' + red('━'.repeat(80)));
        console.error(red('❌ JSON PARSING ERROR'));
        console.error(red('━'.repeat(80)));
        console.error('\n' + yellow('PARSE ERROR: ') + parseError.message);
        console.error('\n' + yellow('RESPONSE LENGTH: ') + message.length + ' characters');
        console.error('\n' + yellow('RESPONSE PREVIEW (first 500 chars):'));
        console.error(cyan('─'.repeat(80)));
        console.error(message.substring(0, 500));
        if (message.length > 500) {
          console.error(cyan('\n... (truncated, see full response in error log) ...'));
        }
        console.error(cyan('─'.repeat(80)));
        console.error('\n' + green('📄 Full debug info saved to: ') + errorLogPath);
        console.error(red('━'.repeat(80)) + '\n');
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. See ${errorLogPath} for details.`);
      }

      if (!promptObj) {
        throw new Error('Failed to parse AI response as JSON.');
      }

      if (argv.flags.verbose) {
        console.log(`${green("✔")} JSON parsed successfully`);
      }

      // Validate required fields
      const validateSpinner = spinner();
      validateSpinner.start("Validating response fields...");

      // Validate that we have some useful information
      const hasTitle = promptObj.internal_file_title || promptObj.file_title || promptObj.title;
      const hasCategory = promptObj.internal_file_category || promptObj.file_category || promptObj.category;
      const hasSomeContent = Object.keys(promptObj).length > 0;

      if (!hasSomeContent) {
        validateSpinner.stop("Validation failed!");
        throw new Error('AI response validation failed: No fields were populated in the response.\n\nThe AI did not provide any useful information about the file.');
      }

      if (!hasTitle) {
        validateSpinner.stop("Validation failed!");
        throw new Error('AI response validation failed: Missing title information.\n\nThe response must include at least one of: internal_file_title, file_title, or title.');
      }

      if (!hasCategory) {
        validateSpinner.stop("Validation failed!");
        throw new Error('AI response validation failed: Missing category information.\n\nThe response must include at least one of: internal_file_category, file_category, or category.');
      }
      
      validateSpinner.stop("Fields validated!");

      if (argv.flags.verbose) {
        console.log(`${green("✔")} Required fields validated`);
      }

      const filenameSpinner = spinner();
      filenameSpinner.start("Generating filename...");
      
      let newFile = await replacePromptKeys(
        format,
        promptObj,
        mainDir,
        fileExt,
        fileCase
      );
      
      filenameSpinner.stop("Filename generated!");

      if (argv.flags.verbose) {
        console.log(`${green("✔")} New filename: ${newFile}`);
      }

      let [folderName, fileName] = separateFolderAndFile(newFile);

      const displaySpinner = spinner();
      displaySpinner.start("Preparing file display...");
      
      await displayChanges(
        "File changes",
        target,
        newFile,
        promptObj.internal_file_tags || '',
        promptObj.internal_file_summary || '',
        ""
      );
      
      displaySpinner.stop("Display complete!");

      if (config.PROMPT_FOR_REVISION_NUMBER && !argv.flags.unattended) {
        const ver = await askForRevisionNumber();
        if (ver != null) {
          [folderName, fileName] = separateFolderAndFile(newFile);
          const newPathWithRevision = resolvePath(
            `${folderName}/${fileName}-v${ver}${fileExt}`
          );
          await displayChanges(
            "File Organized!",
            newFile,
            newPathWithRevision,
            promptObj.internal_file_tags || '',
            promptObj.internal_file_summary || '',
            `-v${ver}`
          );

          newFile = newPathWithRevision;
        }
      }

      if (config.PROMPT_FOR_CUSTOM_CONTEXT && !argv.flags.unattended) {
        const context = await askForContext();
        if (context != null) {
          [folderName, fileName] = separateFolderAndFile(newFile);
          const newPathWithContext = resolvePath(
            `${folderName}/${context}-${fileName}${fileExt}`
          );
          await displayChanges(
            "File Organized!",
            newFile,
            newPathWithContext,
            promptObj.internal_file_tags || '',
            promptObj.internal_file_summary || '',
            context
          );

          newFile = newPathWithContext;
        }
      }

      await displayChanges(
        "File Organized!",
        target,
        newFile,
        promptObj.internal_file_tags || '',
        promptObj.internal_file_summary || '',
        ""
      );

      let confirmed: string | symbol;
      if (argv.flags.force) {
        confirmed = "yes";
        if (argv.flags.verbose) {
          console.log(`${green("✔")} Force mode enabled - skipping confirmation`);
        }
      } else if (argv.flags.dryRun) {
        confirmed = "yes";
        console.log(`${lightCyan("🔍 Dry run mode - no files will be modified")}`);
      } else {
        confirmed = await select({
          message: `Organize your file?\n\n\n`,
          options: [
            {
              value: "yes",
              label: "Yes, organize it this way",
            },
            {
              value: "no",
              label: "No, edit the file organization changes",
            },
            {
              value: "cancel",
              label: "Cancel",
            },
          ],
        });
      }

      while (confirmed !== "yes") {
        if (confirmed === "cancel") {
          process.exit(1); // Exit the script if tryAgain is false
        } else if (confirmed === "no") {
          const filename = await text({
            message: "Enter the new filename:",
            initialValue: newFile,
          });

          if (isCancel(filename)) {
            // User cancelled, keep the original newFile
            console.log(`${yellow("⚠️")} Filename edit cancelled, using original filename.`);
          } else {
            newFile = resolvePath(<string>filename);
            await displayChanges(
              "File changes",
              target,
              newFile,
              promptObj.internal_file_tags || '',
              promptObj.internal_file_summary || '',
              String(filename)
            );
          }
        }

        confirmed = await select({
          message: `Organize your file?\n\n\n`,
          options: [
            {
              value: "yes",
              label: "Yes, organize it this way",
            },
            {
              value: "no",
              label: "No, edit the file organization changes",
            },
            {
              value: "cancel",
              label: "Cancel",
            },
          ],
        });
      }

      if (confirmed == "yes") {
        [folderName, fileName] = separateFolderAndFile(newFile);

        if (argv.flags.dryRun) {
          console.log(`${lightCyan("🔍 Dry run:")} Would create backup directory`);
          console.log(`${lightCyan("🔍 Dry run:")} Would create backup copy of file`);
          console.log(`${lightCyan("🔍 Dry run:")} Would create directory: ${folderName}`);
          console.log(`${lightCyan("🔍 Dry run:")} Would ${config.MOVE_FILE_OPERATION ? 'move' : 'copy'} file to: ${newFile}`);
          console.log(`${lightCyan("🔍 Dry run:")} Would add tags to file`);
          console.log(`${lightCyan("🔍 Dry run:")} Would add summary comments to file`);
        } else {
          // Create backup of original file before organizing
          const backupDir = path.join(os.homedir(), '.aifiles', 'backups');
          const backupFileName = `${path.basename(target)}.backup.${Date.now()}`;
          const backupPath = path.join(backupDir, backupFileName);

          await fs.mkdir(backupDir, { recursive: true });
          await fs.copyFile(resolvePath(target), backupPath);

          if (argv.flags.verbose) {
            console.log(`${green("✔")} Backup created: ${backupPath}`);
          }

          await fs.mkdir(resolvePath(folderName), { recursive: true });
          if (!config.MOVE_FILE_OPERATION) {
            await fs.copyFile(resolvePath(target), `${newFile}`);
            if (argv.flags.verbose) {
              console.log(`${green("✔")} File copied to: ${newFile}`);
            }
          } else {
            await fs.rename(resolvePath(target), `${newFile}`);
            if (argv.flags.verbose) {
              console.log(`${green("✔")} File moved to: ${newFile}`);
            }
          }

          await addTagsToFile(newFile, promptObj.internal_file_tags);
          await addCommentsToFile(newFile, promptObj.internal_file_summary);

          // Track file organization in database
          try {
            const db = new FileDatabase();
            const fileId = db.recordFileOrganization({
              originalPath: resolvePath(target),
              currentPath: newFile,
              backupPath: backupPath,
              originalName: path.basename(target),
              currentName: path.basename(newFile),
              templateId: undefined,
              templateName: undefined,
              category: promptObj.internal_file_category,
              title: promptObj.internal_file_title,
              tags: promptObj.internal_file_tags,
              summary: promptObj.internal_file_summary,
              aiProvider: config.LLM_PROVIDER || 'ollama',
              aiModel: config.LLM_MODEL || 'default',
              aiPrompt: prompt,
              aiResponse: JSON.stringify(promptObj),
            });

            // Mark file as organized in metadata
            await FileMetadataManager.markAsOrganized(newFile, {
              organizedAt: new Date(),
              templateId: undefined,
              fileId: fileId.toString(),
            });

            if (argv.flags.verbose) {
              console.log(`${green("✔")} File tracked in database (ID: ${fileId})`);
              console.log(`${green("✔")} File metadata updated and marked as organized`);
            }
            db.close();
          } catch (dbError) {
            console.warn(`${yellow("⚠")} Could not track file in database: ${dbError}`);
          }
        }
      }

      success = true; // If there are no errors, set success to true and exit the while loop
    } catch (error) {
      outro(`${red("✖")} ${error}`);

      // Check if we're in a TTY environment before showing interactive prompts
      // Also check for asciinema or other recording environments
      const isRecording = process.env.TERM_PROGRAM === 'vscode' ||
                         process.env.ASCIINEMA_REC === '1' ||
                         process.env.AIFILES_NO_INTERACTIVE === 'true';

      if (process.stdout.isTTY && process.stdin.isTTY && !isRecording) {
        try {
          const tryAgain = await select({
            message: "An error occurred. Do you want to try again?",
            options: [
              { value: "yes", label: "Yes, try again." },
              { value: "no", label: "No, please exit." },
            ],
          });
          if (tryAgain != "yes") {
            process.exit(1); // Exit the script if tryAgain is false
          }
        } catch (ttyError) {
          // If TTY operations fail (e.g., in asciinema), just exit
          console.log('\nRun with --help for usage information.');
          console.log('For setup help: aifiles-setup');
          process.exit(1);
        }
      } else {
        // In non-interactive environments, just exit
        console.log('\nRun with --help for usage information.');
        console.log('For setup help: aifiles-setup');
        process.exit(1);
      }
    }
  }

  outro(`${green("✔")} Successfully organized!`);
})();
