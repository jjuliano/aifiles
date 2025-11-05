import fs from 'fs/promises'
import ini from 'ini'
import mime from 'mime'
import os from 'os'
import path from 'path'
import tempfile from 'tempfile'
import { execa } from 'execa'
// Dynamic import to avoid bundling issues
// @ts-ignore - dynamic import type checking
import { confirm, note, text, isCancel } from '@clack/prompts'
import { bgLightRed, lightGreen, reset, white } from 'kolorist'
import { ProviderFactory } from './providers/provider-factory.js'
import { LLMConfig, LLMProvider } from './providers/base-provider.js'

async function makePictureCaption (
  provider: LLMProvider,
  filePath: string,
  customPrompt?: string
): Promise<string> {
  if (provider.analyzeImage) {
    try {
      const prompt = customPrompt || 'Provide a concise, descriptive caption for this image suitable for file organization.';
      return await provider.analyzeImage(filePath, prompt);
    } catch (error) {
      console.warn('Image analysis failed, falling back to EXIF metadata:', error);
      // Fallback to EXIF metadata
      const metadata = await executeExifMetadataExtraction(filePath, 50);
      return metadata || 'image';
    }
  } else {
    // Fallback to EXIF metadata if provider doesn't support vision
    const metadata = await executeExifMetadataExtraction(filePath, 50);
    return metadata || 'image';
  }
}

export type ConfigType = {
  LLM_PROVIDER?: 'openai' | 'grok' | 'ollama' | 'lmstudio' | 'deepseek';
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
  GROK_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  VIDEOS_FILE_NAME_CASE?: string
  VIDEOS_FILENAME_FORMAT?: string
  OTHERS_FILE_NAME_CASE?: string;
  OTHERS_FILENAME_FORMAT?: string;
  PICTURES_FILE_NAME_CASE?: string;
  PICTURES_FILENAME_FORMAT?: string;
  MUSIC_FILE_NAME_CASE?: string;
  MUSIC_FILENAME_FORMAT?: string;
  ARCHIVES_FILE_NAME_CASE?: string;
  ARCHIVES_FILENAME_FORMAT?: string;
  MOVE_FILE_OPERATION?: boolean;
  FIELDS_FILE?: string;
  PROMPT_FILE?: string; // Deprecated: use FIELDS_FILE instead
  OPENAI_API_KEY?: string;
  BASE_DIRECTORY?: string;
  DOWNLOADS_DIRECTORY?: string;
  DESKTOP_DIRECTORY?: string;
  DOCUMENT_DIRECTORY?: string;
  MUSIC_DIRECTORY?: string;
  PICTURES_DIRECTORY?: string;
  VIDEOS_DIRECTORY?: string;
  ARCHIVES_DIRECTORY?: string;
  OTHERS_DIRECTORY?: string;
  DOCUMENT_FILENAME_FORMAT?: string;
  DOCUMENT_FILE_NAME_CASE?: string;
  MAX_MEDIA_DATA_SOURCES?: number;
  MAX_CONTENT_WORDS?: number;
  PROMPT_FOR_REVISION_NUMBER?: boolean;
  PROMPT_FOR_CUSTOM_CONTEXT?: boolean;
  ADD_FILE_TAGS?: boolean;
  ADD_FILE_COMMENTS?: boolean;
  FILE_MANAGER_INDEX_MODE?: 'launch' | 'on-demand';
  ORGANIZATION_TIMEOUT?: number;
  REANALYZE_PROMPT?: string;
  WATCH_MODE_PROMPT?: string;
  ORGANIZATION_PROMPT_TEMPLATE?: string;
  IMAGE_CAPTION_PROMPT?: string;
};

export const fileExists = (filePath: string) => {
  return fs.access(filePath).then(
    () => true,
    () => false
  )
}

const migrateLegacyConfig = async (): Promise<void> => {
  const newDir = path.join(os.homedir(), '.aifiles')

  try {
    // Migrate ~/.aifiles to ~/.aifiles/config
    const legacyConfigPath = path.join(os.homedir(), '.aifiles')
    const newConfigPath = path.join(newDir, 'config')

    const legacyConfigExists = await fileExists(legacyConfigPath)
    if (legacyConfigExists) {
      // Create new directory if it doesn't exist
      await fs.mkdir(newDir, { recursive: true })

      // Check if new config file already exists
      const newConfigExists = await fileExists(newConfigPath)
      if (!newConfigExists) {
        // Move legacy config file to new location
        await fs.rename(legacyConfigPath, newConfigPath)
        console.log('✅ Migrated config from ~/.aifiles to ~/.aifiles/config')
      }
    }

    // Migrate legacy prompts file to ~/.aifiles/fields.json
    const legacyPromptsPath = path.join(os.homedir(), '.aifiles.json')
    const oldPromptsPath = path.join(newDir, 'prompts.json')
    const newFieldsPath = path.join(newDir, 'fields.json')

    const legacyPromptsExists = await fileExists(legacyPromptsPath)
    const oldPromptsExists = await fileExists(oldPromptsPath)
    if (legacyPromptsExists) {
      // Create new directory if it doesn't exist
      await fs.mkdir(newDir, { recursive: true })

      // Check if new fields file already exists
      const newFieldsExists = await fileExists(newFieldsPath)
      if (!newFieldsExists) {
        // Move legacy prompts file to new location
        await fs.rename(legacyPromptsPath, newFieldsPath)
        console.log('✅ Migrated field definitions from ~/.aifiles.json to ~/.aifiles/fields.json')
      }
    } else if (oldPromptsExists) {
      // Migrate from old prompts.json to new fields.json
      const newFieldsExists = await fileExists(newFieldsPath)
      if (!newFieldsExists) {
        await fs.rename(oldPromptsPath, newFieldsPath)
        console.log('✅ Migrated field definitions from prompts.json to fields.json')
      }
    }
  } catch (error) {
    // Ignore migration errors
  }
}

export const getConfig = async (): Promise<ConfigType> => {
  const configPath = path.join(os.homedir(), '.aifiles', 'config')
  await migrateLegacyConfig();

  const configExists = await fileExists(configPath)
  if (!configExists) {
    return {}
  }

  const configString = await fs.readFile(configPath, 'utf8')
  return ini.parse(configString)
}

export const saveConfig = async (config: Partial<ConfigType>): Promise<void> => {
  const configDir = path.join(os.homedir(), '.aifiles')
  const configPath = path.join(configDir, 'config')
  await migrateLegacyConfig();

  // Ensure the config directory exists
  await fs.mkdir(configDir, { recursive: true })

  const currentConfig = await getConfig()
  const newConfig = { ...currentConfig, ...config }
  const configString = ini.stringify(newConfig)
  await fs.writeFile(configPath, configString, 'utf8')
}

export const createDefaultConfig = async (): Promise<void> => {
  const configDir = path.join(os.homedir(), '.aifiles')
  const configPath = path.join(configDir, 'config')
  const fieldsPath = path.join(configDir, 'fields.json')
  await migrateLegacyConfig();

  const configExists = await fileExists(configPath)

  if (!configExists) {
    // Ensure the config directory exists
    await fs.mkdir(configDir, { recursive: true })

    // Create default config with local LLM as default
    const defaultConfig: Partial<ConfigType> = {
      LLM_PROVIDER: 'ollama',
      LLM_MODEL: 'llama3.2',
      LLM_BASE_URL: 'http://127.0.0.1:11434',
      BASE_DIRECTORY: '~',
      DOWNLOADS_DIRECTORY: 'Downloads',
      DESKTOP_DIRECTORY: 'Desktop',
      DOCUMENT_DIRECTORY: 'Documents',
      MUSIC_DIRECTORY: 'Music',
      PICTURES_DIRECTORY: 'Pictures',
      VIDEOS_DIRECTORY: 'Videos',
      ARCHIVES_DIRECTORY: 'Archives',
      OTHERS_DIRECTORY: 'Others',
      DOCUMENT_FILENAME_FORMAT: '{file_category_1}/{file_category_2}/{file_category_3}--{file_title}',
      DOCUMENT_FILE_NAME_CASE: 'snake',
      MUSIC_FILENAME_FORMAT: '{music_artist}/{music_album}/{music_track_number}--{music_track_title}',
      MUSIC_FILE_NAME_CASE: 'kebab',
      PICTURES_FILENAME_FORMAT: '{picture_date_taken}/{file_title}',
      PICTURES_FILE_NAME_CASE: 'lower_snake',
      VIDEOS_FILENAME_FORMAT: '{file_category_1}/{file_category_2}/{file_title}',
      VIDEOS_FILE_NAME_CASE: 'upper_snake',
      ARCHIVES_FILENAME_FORMAT: '{file_category_1}/{file_category_2}/{file_title}--{file_date_created}',
      ARCHIVES_FILE_NAME_CASE: 'pascal',
      OTHERS_FILENAME_FORMAT: '{file_category_1}/{file_category_2}/{file_title}',
      OTHERS_FILE_NAME_CASE: 'pascal',
      MOVE_FILE_OPERATION: true,
      MAX_MEDIA_DATA_SOURCES: 50,
      MAX_CONTENT_WORDS: 50,
      PROMPT_FOR_REVISION_NUMBER: true,
      PROMPT_FOR_CUSTOM_CONTEXT: true,
    }

    const configString = ini.stringify(defaultConfig)
    await fs.writeFile(configPath, configString, 'utf8')
  }

  // Create default fields.json if it doesn't exist
  const fieldsExists = await fileExists(fieldsPath)
  if (!fieldsExists) {
    const defaultPrompts = {
      // Required prompts for file organization
      internal_file_title: 'A short, concise, and informative title for the file based on its content (keep under 50 characters when possible).',
      internal_file_category: 'The primary category that best describes the file content.',
      internal_file_summary: 'A brief summary or abstract of the contents of the file.',
      internal_file_tags: 'A list of keywords or tags associated with the file.',

      // File categorization prompts
      file_category_1: 'Primary category (e.g., work, personal, project)',
      file_category_2: 'Secondary category or subcategory',
      file_category_3: 'Tertiary category or specific type',

      // File title prompt
      file_title: 'Short, concise, and informative title for the file (keep under 50 characters when possible)',

      // Music-specific prompts
      music_artist: 'Artist or band name',
      music_album: 'Album title',
      music_track_title: 'Song title (keep concise)',
      music_track_number: 'Track number',

      // Picture-specific prompts
      picture_date_taken: 'Date when the picture was taken (YYYY-MM-DD)',
      picture_location: 'Location where the picture was taken',
      picture_description: 'Description of what the picture shows',

      // Video-specific prompts
      video_duration: 'Duration of the video',
      video_quality: 'Video quality/resolution',

      // Document-specific prompts
      document_author: 'Author of the document',
      document_pages: 'Number of pages',
      document_language: 'Primary language of the document',

      // Archive-specific prompts
      archive_contents: 'Description of what the archive contains',
      archive_compression: 'Compression method used',

      // Date/time prompts
      file_date_created: 'Date when the file was created (YYYY-MM-DD)',
      file_date_modified: 'Date when the file was last modified (YYYY-MM-DD)',

      // Generic content prompts
      content_type: 'Type of content in the file',
      content_language: 'Language of the content',
      content_topic: 'Main topic or subject matter',

      // Organization prompts
      organization_department: 'Department or team responsible',
      organization_project: 'Project or initiative name',
      organization_client: 'Client or stakeholder name'
    }

    await fs.writeFile(fieldsPath, JSON.stringify(defaultPrompts, null, 2), 'utf8')
  }
}

export const separateFolderAndFile = (filePath: string): [string, string] => {
  if (typeof filePath !== 'string') {
    throw new Error(`separateFolderAndFile: expected string, got ${typeof filePath}`);
  }
  const parts = filePath.split('/');
  const file = parts.pop() as string;
  const folder = parts.join('/');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [name, _] = file.split('.');
  return [folder, name];
}

export const askForRevisionNumber = async (): Promise<string | null> => {
  const enterRevisionNumber = await confirm({
    message: `Do you want to enter the revision number?\n\n`,
  })

  if (enterRevisionNumber) {
    const revisionNumber = await text({
      message: 'What is the revision number?',
      placeholder: '1',
      initialValue: '',
      validate (value) {
        if (value.length === 0) return `Value is required!`
      },
    })

    if (isCancel(revisionNumber)) {
      return null
    }

    return <string>revisionNumber
  }
  return null
}

export const askForContext = async (): Promise<string | null> => {
  const enterContext = await confirm({
    message: `Do you want to enter a context?\n\n`,
  })

  if (enterContext) {
    const context = await text({
      message: 'What is the context?',
      placeholder: 'ACMECompany',
      initialValue: '',
      validate (value) {
        if (value.length === 0) return `Value is required!`
      },
    })

    if (isCancel(context)) {
      return null
    }

    return <string>context
  }

  return null
}

export const displayChanges = async (
  title: string,
  oldFile: string,
  newFile: string,
  tags: string,
  summary: string,
  diff: string
) => {
  const fileChangesOld = reset(
    lightGreen(`${reset(white('Old file:'))} ${reset(lightGreen(oldFile))}`)
  )
  let fileChangesNew = reset(
    lightGreen(`${reset(white('New file:'))} ${reset(lightGreen(newFile))}`)
  )
  if (diff) {
    fileChangesNew = reset(
      lightGreen(
        `${reset(white('New file:'))} ${reset(
          lightGreen(highlightString(newFile, diff))
        )}`
      )
    )
  }
  const newTags = reset(
    lightGreen(`${reset(white('File tags:'))}  ${reset(lightGreen(tags))}`)
  )
  const comment = reset(
    lightGreen(`${reset(white('File comment:'))} ${reset(lightGreen(summary))}`)
  )

  const message = `${fileChangesOld}\n${fileChangesNew}\n${newTags}\n${comment}`
  note(message, title)
}

function highlightString (text: string, highlight: string): string {
  const startIndex = text.toLowerCase().indexOf(highlight.toLowerCase())
  if (startIndex === -1) {
    return text
  }

  const endIndex = startIndex + highlight.length
  const before = text.slice(0, startIndex)
  const middle = bgLightRed(white(text.slice(startIndex, endIndex)))
  const after = text.slice(endIndex)

  return `${before}${middle}${after}`
}

interface PromptObject {
  [key: string]: string;
}

const extractPrompts = async (
  promptFilePath: string,
  inputString: string
): Promise<{ promptString: string; fieldNames: string[] }> => {
  let promptFile: PromptObject = {}

  try {
    const promptFileContent = await fs.readFile(resolvePath(`${promptFilePath}`))
    promptFile = JSON.parse(String(promptFileContent))
  } catch (error) {
  // If prompts file doesn't exist, use default prompts
  promptFile = {
    internal_file_title: 'A descriptive title for the file based on its content.',
    internal_file_category: 'The primary category that best describes the file content.',
    internal_file_summary: 'A brief summary or abstract of the contents of the file.',
    internal_file_tags: 'A list of keywords or tags associated with the file.',
    file_category_1: 'Primary category (e.g., work, personal, project)',
    file_category_2: 'Secondary category or subcategory',
    file_category_3: 'Tertiary category or specific type',
    file_title: 'Descriptive title for the file',
      music_artist: 'Artist or band name',
      music_album: 'Album title',
      music_track_title: 'Song title',
      music_track_number: 'Track number',
      picture_date_taken: 'Date when the picture was taken (YYYY-MM-DD)',
      picture_location: 'Location where the picture was taken',
      picture_description: 'Description of what the picture shows',
      video_duration: 'Duration of the video',
      video_quality: 'Video quality/resolution',
      document_author: 'Author of the document',
      document_pages: 'Number of pages',
      document_language: 'Primary language of the document',
      archive_contents: 'Description of what the archive contains',
      archive_compression: 'Compression method used',
      file_date_created: 'Date when the file was created (YYYY-MM-DD)',
      file_date_modified: 'Date when the file was last modified (YYYY-MM-DD)',
      content_type: 'Type of content in the file',
      content_language: 'Language of the content',
      content_topic: 'Main topic or subject matter',
      organization_department: 'Department or team responsible',
      organization_project: 'Project or initiative name',
      organization_client: 'Client or stakeholder name'
    }
  }

  const requiredPrompts = {
    internal_file_title: 'A descriptive title for the file based on its content.',
    internal_file_category: 'The primary category that best describes the file content.',
    internal_file_summary: 'A brief summary or abstract of the contents of the file.',
    internal_file_tags: 'A list of keywords or tags associated with the file.',
  }

  const result: PromptObject = {}
  const regex = /\{(.*?)}/g
  const matches = inputString.match(regex) ?? []

  matches.forEach((match) => {
    const key = match.slice(1, -1)
    if (promptFile[key]) {
      result[key] = promptFile[key]
    }
  })

  const finalPrompts = Object.assign({}, result, requiredPrompts)
  const fieldNames = Object.keys(finalPrompts)
  
  return {
    promptString: JSON.stringify(finalPrompts),
    fieldNames
  }
}

export const parseJson = async (jsonString: string | undefined): Promise<any> => {
  try {
    return await new Promise((resolve, reject) => {
      try {
        if (typeof jsonString === 'string') {
          // Strip markdown code fences if present (e.g., ```json ... ```)
          let cleaned = jsonString.trim();

          // Remove opening code fence with optional language specifier
          cleaned = cleaned.replace(/^```(?:json|jsonc)?\s*\n?/i, '');

          // Remove closing code fence
          cleaned = cleaned.replace(/\n?```\s*$/i, '');

          // Also handle backticks without language specifier
          cleaned = cleaned.replace(/^`+\s*\n?/, '');
          cleaned = cleaned.replace(/\n?`+\s*$/, '');

          // Trim again after stripping fences
          cleaned = cleaned.trim();

          // Handle LLM wrapping entire JSON in quotes: "{ ... }"
          // Check if it starts with " and ends with " and contains { or [
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            let inner = cleaned.slice(1, -1);
            // Only unwrap if the inner content looks like JSON
            if (inner.trim().startsWith('{') || inner.trim().startsWith('[')) {
              // Unescape any escaped quotes if present
              inner = inner.replace(/\\"/g, '"');
              cleaned = inner;
            }
          }

          // Trim one final time
          cleaned = cleaned.trim();

          // Handle extra closing braces by finding balanced JSON
          const startIndex = cleaned.indexOf('{');
          if (startIndex !== -1) {
            let braceCount = 0;
            let endIndex = -1;

            for (let i = startIndex; i < cleaned.length; i++) {
              if (cleaned[i] === '{') {
                braceCount++;
              } else if (cleaned[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  endIndex = i;
                  break;
                }
              }
            }

            if (endIndex !== -1) {
              // Extract properly balanced JSON
              cleaned = cleaned.substring(startIndex, endIndex + 1);
            } else {
              // Fallback: remove trailing extra braces
              cleaned = cleaned.replace(/}+$/g, '}');
            }
          }

          // Handle LLM returning JSON properties without wrapping braces
          // E.g.: "field":"value","field2":"value2"
          // Check if it starts with " followed by alphanumeric (not { or [)
          if (cleaned.startsWith('"') && !cleaned.startsWith('"{') && !cleaned.startsWith('"[')) {
            // Check if it contains JSON-like key:value patterns
            if (cleaned.includes('":"') || cleaned.includes('":')) {
              // Wrap in braces
              cleaned = '{' + cleaned + '}';
            }
          }
          
          // Handle extra closing braces: }} or }}} etc.
          // Remove duplicate closing braces at the end
          while (cleaned.endsWith('}}') || cleaned.endsWith(']]')) {
            cleaned = cleaned.slice(0, -1);
          }
          
          // Handle extra opening braces: {{ or {{{ etc.
          while (cleaned.startsWith('{{') || cleaned.startsWith('[[')) {
            cleaned = cleaned.slice(1);
          }
          
          // Final trim
          cleaned = cleaned.trim();
          
          resolve(JSON.parse(cleaned))
        } else {
          reject(new Error('JSON string is undefined or not a string'))
        }
      } catch (err) {
        reject(err)
      }
    })
  } catch (err) {
    console.error(`Error parsing JSON: ${err}`)
    throw err
  }
}

export const replacePromptKeys = async (
  fileFormat: string | undefined,
  promptObj: any,
  mainDir: string | undefined,
  fileExt: string | undefined,
  fileCase: string | undefined,
  reservedWords?: { [p: string]: string | ((value: string) => string) }
): Promise<string> => {
  if (!fileFormat) {
    throw new Error('File format is required for replacePromptKeys');
  }
  if (!mainDir) {
    throw new Error('Main directory is required for replacePromptKeys');
  }
  if (!fileExt) {
    throw new Error('File extension is required for replacePromptKeys');
  }

  const promptKeys = Object.keys(promptObj)

  let replacedString = fileFormat
  promptKeys.forEach((key) => {
    let replacementValue = promptObj[key]

    if (reservedWords && reservedWords[key]) {
      const reservedWordValue = reservedWords[key]
      if (typeof reservedWordValue === 'string') {
        replacementValue = reservedWordValue
      } else if (typeof reservedWordValue === 'function') {
        replacementValue = reservedWordValue(promptObj[key])
      }
    }
    if (replacementValue === null || replacementValue === undefined) {
      replacementValue = ''
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    replacedString = replacedString.replace(`{${key}}`, replacementValue)
  })
  const newPath = resolvePath(`${mainDir}/${replacedString}${fileExt}`)
  const [folderName, fileName] = separateFolderAndFile(newPath)
  const cleanedFileName = fileName.replace(/^\W+/, '') // Remove trailing '-' characters
  const newFileName = changeCase(cleanedFileName, fileCase)

  return resolvePath(`${folderName}/${newFileName}${fileExt}`)
}

export const resolvePath = (relativePath: string): string => {
  if (!relativePath) {
    console.error('resolvePath called with empty/undefined path');
    return '';
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    console.error('Neither HOME nor USERPROFILE environment variables are set');
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const resolved = path.resolve(
    relativePath.replace(
      /^~(?=$|\/|\\)/,
      `${home}`
    )
  );

  return resolved;
}

const makeFileNameSafe = (fileName: string): string => {
  const extname = path.extname(fileName)
  const name = fileName.replace(/[^\w/]+/g, '_')
  return name.replace(/^_+|_+$/g, '') + `${extname}`
}

export const changeCase = (str: string, typ: string | undefined): string => {
  const cleanStr = str.replace(/[^\w\s\-_]/gi, '') // Remove all non-alphanumeric characters except "-"
  switch (typ) {
    case 'camel':
      return cleanStr
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase()
        })
        .replace(/\s+/g, '')
    case 'snake':
      return cleanStr.replace(/\s+/g, '_')
    case 'kebab':
      return cleanStr.replace(/\s+/g, '-').toLowerCase()
    case 'pascal':
      return cleanStr
        .replace(/\w+/g, (word) => {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .replace(/\s+/g, '')
    case 'upper_snake':
      return cleanStr.replace(/\s+/g, '_').toUpperCase()
    case 'lower_snake':
      return cleanStr.replace(/\s+/g, '_').toLowerCase()
    default:
      return cleanStr
  }
}

export const createTempFile = async (
  content: string,
  extension: string
): Promise<string> => {
  const outputFilePath = tempfile({ extension })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [folderName, _] = separateFolderAndFile(outputFilePath)
  await fs.mkdir(resolvePath(folderName), { recursive: true })
  await fs.writeFile(outputFilePath, content)

  return outputFilePath
}

function filterOutNonLetters (text: string, numWords?: number): string {
  const lettersOnly = text.replace(/[^a-zA-Z\s]/g, '')
  if (numWords) {
    return lettersOnly.split(/\s+/).slice(0, numWords).join(' ')
  } else {
    return lettersOnly
  }
}

async function getDocumentContents (inputFile: string, numWords?: number): Promise<string> {
  try {
    const fileExtension = inputFile.split('.').pop()?.toLowerCase()

    if (fileExtension === 'txt' || fileExtension === 'md') {
      const { stdout } = await execa('cat', [inputFile])
      return filterOutNonLetters(stdout, numWords)
    } else if (fileExtension === 'csv' || fileExtension === 'xls' || fileExtension === 'xlsx') {
      const { stdout } = await execa('in2csv', [inputFile])
      return filterOutNonLetters(stdout, numWords)
    } else if (fileExtension === 'ppt' || fileExtension === 'pptx') {
      const { stdout } = await execa('pandoc', [
        '-s',
        '--extract-media=.pandoc-media',
        '--wrap=none',
        '--to=plain',
        inputFile,
      ])
      return filterOutNonLetters(stdout, numWords)
    } else if (fileExtension === 'pdf') {
      const { stdout } = await execa('pdftotext', [inputFile, '-'])
      return filterOutNonLetters(stdout, numWords)
    } else {
      const { stdout } = await execa('pandoc', [
        '-s',
        '--extract-media=.pandoc-media',
        '--wrap=none',
        '--reference-links',
        '--standalone',
        '--to=plain',
        inputFile,
      ])
      return filterOutNonLetters(stdout, numWords)
    }
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to convert ${inputFile} to plain text.`)
  }
}

export const executeExifMetadataExtraction = async (
  filePath: string,
  numWords: number
): Promise<string> => {
  const resolvedPath = resolvePath(filePath);
  if (!resolvedPath) {
    throw new Error(`Failed to resolve path: ${filePath}`);
  }
  const { stdout: exifMetadata } = await execa('exiftool', [
    resolvedPath,
  ])

  return compressString(exifMetadata).split(/\s+/).slice(0, numWords).join(' ')
}

export const getPrompt = async (
  config: ConfigType,
  filePath: string,
  llmProvider: LLMProvider,
  maxWord: number
): Promise<{
  format: string | undefined;
  mainDir: string | undefined;
  fileExt: string | undefined;
  fileCase: string | undefined;
  prompt: string;
}> => {
  const mimeType: string | null = mime.getType(filePath)
  const fileCategory: string = categorizeFileByMimeType(mimeType)
  const exifMetadata = await executeExifMetadataExtraction(filePath, maxWord)
  const fileExt = path.extname(filePath)

  let content
  let format
  let mainDir
  let fileCase

  switch (fileCategory) {
    case 'Documents': {
      content = await getDocumentContents(
        filePath,
        Number(config.MAX_CONTENT_WORDS)
      )
      format = String(config.DOCUMENT_FILENAME_FORMAT)
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.DOCUMENT_DIRECTORY}`
      )
      fileCase = String(config.DOCUMENT_FILE_NAME_CASE)
      break
    }
    case 'Music': {
      // @ts-ignore - dynamic import
      const { parseFile } = await import('music-metadata')
      const { common } = await parseFile(filePath)
      delete common.picture
      const musicMetaDataEntries = Object.entries(common).slice(
        0,
        config.MAX_MEDIA_DATA_SOURCES
      )
      content = compressString(JSON.stringify(musicMetaDataEntries))
        .split(/\s+/)
        .slice(0, config.MAX_CONTENT_WORDS)
        .join(' ')
      format = String(config.MUSIC_FILENAME_FORMAT)
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.MUSIC_DIRECTORY}`
      )
      fileCase = String(config.MUSIC_FILE_NAME_CASE)

      break
    }
    case 'Pictures': {
      content = await makePictureCaption(llmProvider, filePath, config.IMAGE_CAPTION_PROMPT)
      format = String(config.PICTURES_FILENAME_FORMAT)
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.PICTURES_DIRECTORY}`
      )
      fileCase = String(config.PICTURES_FILE_NAME_CASE)

      break
    }
    case 'Videos': {
      content = await executeExifMetadataExtraction(
        filePath,
        Number(config.MAX_CONTENT_WORDS)
      )
      format = String(config.VIDEOS_FILENAME_FORMAT)
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.VIDEOS_DIRECTORY}`
      )
      fileCase = String(config.VIDEOS_FILE_NAME_CASE)

      break
    }
    case 'Archives': {
      content = await executeExifMetadataExtraction(
        filePath,
        Number(config.MAX_CONTENT_WORDS)
      )
      format = String(config.ARCHIVES_FILENAME_FORMAT)
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.ARCHIVES_DIRECTORY}`
      )
      fileCase = String(config.ARCHIVES_FILE_NAME_CASE)

      break
    }
    default: {
      // For text files (txt, md, etc.), read actual content
      // For other files, use EXIF metadata
      const textTypes = ['text/plain', 'text/markdown', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml'];
      const isTextFile = textTypes.includes(<string>mimeType) || mimeType?.startsWith('text/');
      
      if (isTextFile) {
        try {
          content = await getDocumentContents(
            filePath,
            Number(config.MAX_CONTENT_WORDS)
          )
        } catch (error) {
          // Fallback to EXIF if content extraction fails
          content = await executeExifMetadataExtraction(
            filePath,
            Number(config.MAX_CONTENT_WORDS)
          )
        }
      } else {
        content = await executeExifMetadataExtraction(
          filePath,
          Number(config.MAX_CONTENT_WORDS)
        )
      }
      
      format = config.OTHERS_FILENAME_FORMAT
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.OTHERS_DIRECTORY}`
      )
      fileCase = config.OTHERS_FILE_NAME_CASE

      break
    }
  }

  // Use FIELDS_FILE with backward compatibility for PROMPT_FILE
  const fieldsFile = config.FIELDS_FILE || config.PROMPT_FILE || '~/.aifiles/fields.json';
  
  const { promptString: extractedPrompts, fieldNames } = await extractPrompts(
    fieldsFile,
    String(format)
  )

  const prompt = generatePrompt(
    filePath,
    String(content),
    exifMetadata,
    mimeType,
    fileCategory,
    extractedPrompts,
    fieldNames,
    config.ORGANIZATION_PROMPT_TEMPLATE
  )

  // Ensure required fields are never undefined
  if (!format) {
    throw new Error(`Missing FILENAME_FORMAT configuration for file category: ${fileCategory}`);
  }
  if (!mainDir) {
    throw new Error(`Missing DIRECTORY configuration for file category: ${fileCategory}`);
  }
  if (!fileCase) {
    throw new Error(`Missing FILE_NAME_CASE configuration for file category: ${fileCategory}`);
  }

  return {
    fileCase,
    fileExt,
    format,
    mainDir,
    prompt,
  }
}

export const categorizeFileByMimeType = (mimeType: string | null): string => {
  const imageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/svg+xml',
    'image/tiff',
  ]
  const audioTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-midi']
  const videoTypes = ['video/mp4', 'video/mpeg', 'video/ogg', 'video/webm']
  const documentTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]
  const archiveTypes = [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/x-gzip',
  ]
  if (imageTypes.includes(<string>mimeType)) {
    return 'Pictures'
  } else if (audioTypes.includes(<string>mimeType)) {
    return 'Music'
  } else if (videoTypes.includes(<string>mimeType)) {
    return 'Videos'
  } else if (documentTypes.includes(<string>mimeType)) {
    return 'Documents'
  } else if (archiveTypes.includes(<string>mimeType)) {
    return 'Archives'
  } else {
    return 'Others'
  }
}

export const generatePrompt = (
  fileName: string,
  fileContent: string,
  exifMetadata: string,
  mimeType: string | null,
  mimeCategory: string,
  additionalPrompts: string,
  requiredFields: string[],
  customTemplate?: string
): string => {
  let prompt = '';
  
  // Use custom template if provided, otherwise use default
  if (customTemplate) {
    // Replace placeholders in custom template
    prompt = customTemplate
      .replace('{fileName}', fileName)
      .replace('{fileContent}', fileContent)
      .replace('{exifMetadata}', exifMetadata)
      .replace('{mimeType}', mimeType || 'unknown')
      .replace('{mimeCategory}', mimeCategory)
      .replace('{additionalPrompts}', additionalPrompts);
  } else {
    // Default template
    prompt = `Without prefacing it with anything, giving explanations or
  justifications, write a JSON object with an insightful but concise information
  for a "${fileName}" file classified as "${mimeType} - ${mimeCategory}" with
  the file contents "${fileContent}". Make sure you double quote the JSON
  properties and values so it is valid JSON.

  ### ${additionalPrompts}`;
  }
  
  // Include all available fields for the AI to populate
  const allFieldsList = requiredFields.join(', ');

  prompt += `\n\nAVAILABLE FIELDS (populate as many as possible based on the file content):
${allFieldsList}

Respond only with valid JSON containing all relevant fields you can populate from analyzing the file.

IMPORTANT REQUIREMENTS:
- Start your response with { and end with }
- Do not write an introduction or summary
- Do not wrap the JSON in quotes or markdown code blocks
- Return ONLY the JSON object, nothing else
- Include as many fields as possible from the available list`;
  
  return prompt;
}

function compressString (str: string): string {
  // Remove special characters
  str = str.replace(/[^\w\s]/gi, '')

  // Remove double spaces and newlines, replace with single space
  str = str.replace(/\s+/g, ' ')

  // Remove duplicate words
  const words = str.split(' ')
  const uniqueWords = [...new Set(words)]
  str = uniqueWords.join(' ')

  return str
}

export const generatePromptResponse = async (
  config: ConfigType,
  prompt: string | undefined
): Promise<string | undefined> => {
  if (!prompt) {
    return undefined;
  }

  // Determine provider and get API key
  const provider = config.LLM_PROVIDER || 'ollama';
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
  const result = await llmProvider.sendMessage(prompt);

  return result;
}

export async function addTagsToFile (
  file: string,
  tagString: string | undefined
): Promise<void> {
  if (!tagString || typeof tagString !== 'string') {
    return; // Skip if no tags provided or not a string
  }
  const tags = tagString.split(",").map(t => t.trim()).filter(Boolean)
  const filePath = resolvePath(<string>file)
  const platform = process.platform

  if (platform !== 'darwin') {
    console.log(`Tags not supported on ${platform}, skipping: ${tags.join(', ')}`)
    return
  }

  try {
    // Use native macOS tagging via xattr
    for (const tag of tags) {
      await execa('xattr', [
        '-w',
        'com.apple.metadata:_kMDItemUserTags',
        `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array><string>${tag}</string></array></plist>`,
        filePath
      ])
    }
  } catch (error) {
    console.warn(`Failed to add tags to ${filePath}:`, error)
  }
}

export async function addCommentsToFile (
  file: string,
  commentString: string | undefined
): Promise<void> {
  if (!commentString || typeof commentString !== 'string') {
    return; // Skip if no comment provided or not a string
  }
  const platform = process.platform
  const filePath = resolvePath(<string>file)

  switch (platform) {
    case 'darwin':
      // On macOS, we use AppleScript to add a comment to the file.
      // eslint-disable-next-line no-case-declarations
      const escapedFilePath = filePath.replace(/(["'$`\\])/g, '\\$1') // escape special characters
      // eslint-disable-next-line no-case-declarations
      const escapedComment = commentString.replace(/'/g, '\'\'')
      // eslint-disable-next-line no-case-declarations
      const script = `tell application "Finder" to set comment of (POSIX file "${escapedFilePath}" as alias) to "${escapedComment}"`
      await execa('osascript', ['-e', script])
      break
    case 'win32':
      // TODO
      break
    case 'linux':
      // TODO
      break
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

// File metadata utilities for tracking organization status
export class FileMetadataManager {
  // Check if a file has AIFiles metadata (indicating it was organized)
  static async hasAIFilesMetadata(filePath: string): Promise<boolean> {
    try {
      // Try extended attributes first (macOS/Linux)
      try {
        await execa('xattr', ['-p', 'com.aifiles.organized', filePath]);
        return true;
      } catch {
        // Extended attributes not available or not set
      }

      // Fallback: check for sidecar metadata file
      const metadataPath = `${filePath}.aifiles`;
      try {
        await fs.access(metadataPath);
        return true;
      } catch {
        // Sidecar file doesn't exist
      }

      return false;
    } catch (error) {
      // If we can't check metadata, assume it's unorganized
      return false;
    }
  }

  // Mark a file as organized by writing metadata
  static async markAsOrganized(filePath: string, metadata?: {
    organizedAt?: Date;
    templateId?: string;
    fileId?: string;
  }): Promise<void> {
    try {
      const metadataContent = {
        organized: true,
        organizedAt: metadata?.organizedAt?.toISOString() || new Date().toISOString(),
        templateId: metadata?.templateId || '',
        fileId: metadata?.fileId || '',
        version: '1.0',
      };

      // Try extended attributes first
      try {
        const jsonContent = JSON.stringify(metadataContent);
        await execa('xattr', ['-w', 'com.aifiles.organized', jsonContent, filePath]);
        return;
      } catch {
        // Extended attributes not available, use sidecar file
      }

      // Fallback: create sidecar metadata file
      const metadataPath = `${filePath}.aifiles`;
      await fs.writeFile(metadataPath, JSON.stringify(metadataContent, null, 2), 'utf-8');

    } catch (error) {
      // Silently fail - metadata writing is not critical
      console.warn(`Warning: Could not write metadata for ${filePath}:`, error);
    }
  }

  // Get metadata for an organized file
  static async getAIFilesMetadata(filePath: string): Promise<any | null> {
    try {
      // Try extended attributes first
      try {
        const { stdout } = await execa('xattr', ['-p', 'com.aifiles.organized', filePath]);
        return JSON.parse(stdout);
      } catch {
        // Extended attributes not available or not set
      }

      // Try sidecar file
      const metadataPath = `${filePath}.aifiles`;
      try {
        const content = await fs.readFile(metadataPath, 'utf-8');
        return JSON.parse(content);
      } catch {
        // Sidecar file doesn't exist or is invalid
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // Remove metadata (when restoring file to unorganized state)
  static async removeAIFilesMetadata(filePath: string): Promise<void> {
    try {
      // Try to remove extended attribute
      try {
        await execa('xattr', ['-d', 'com.aifiles.organized', filePath]);
      } catch {
        // Extended attribute doesn't exist or can't be removed
      }

      // Try to remove sidecar file
      const metadataPath = `${filePath}.aifiles`;
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Sidecar file doesn't exist
      }
    } catch (error) {
      // Silently fail - metadata removal is not critical
    }
  }
}
