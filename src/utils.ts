import fs from 'fs/promises'
import ini from 'ini'
import mime from 'mime'
import os from 'os'
import path from 'path'
import tempfile from 'tempfile'
import { execa } from 'execa'
import { parseFile } from 'music-metadata'
import { confirm, note, text } from '@clack/prompts'
import { bgLightRed, lightGreen, reset, white } from 'kolorist'
import Replicate from 'replicate-js'
import { ChatGPTAPI } from 'chatgpt'

async function makePictureCaption (
  client: Replicate,
  filePath: string
): Promise<string> {
  const model = await client.models.get('salesforce/blip')
  const fileData = await fs.readFile(filePath)
  const base64Data = fileData.toString('base64')
  return await model.predict({
    image: `data:application/octet-stream;base64,${base64Data}`,
  })
}

type ConfigType = {
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
  PROMPT_FILE?: string;
  REPLICATE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  BASE_DIRECTORY?: string;
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
};

export const fileExists = (filePath: string) => {
  return fs.access(filePath).then(
    () => true,
    () => false
  )
}

export const getConfig = async (): Promise<ConfigType> => {
  const configPath = path.join(os.homedir(), '.aifiles')
  const configExists = await fileExists(configPath)
  if (!configExists) {
    return {}
  }

  const configString = await fs.readFile(configPath, 'utf8')
  return ini.parse(configString)
}

export const separateFolderAndFile = (path: string): [string, string] => {
  const parts = path.split('/')
  const file = parts.pop() as string
  const folder = parts.join('/')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [name, _] = file.split('.')
  return [folder, name]
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
): Promise<string> => {
  const promptFileContent = await fs.readFile(resolvePath(`${promptFilePath}`))
  const promptFile: PromptObject = JSON.parse(String(promptFileContent))
  const requiredPrompts = {
    internal_file_summary:
      'A brief summary or abstract of the contents of the file.',
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

  return JSON.stringify(Object.assign({}, result, requiredPrompts))
}

export const parseJson = async (jsonString: string | undefined): Promise<any> => {
  try {
    return await new Promise((resolve, reject) => {
      try {
        if (typeof jsonString === 'string') {
          resolve(JSON.parse(jsonString))
        }
      } catch (err) {
        reject(err)
      }
    })
  } catch (err) {
    console.error(`Error parsing JSON: ${err}`)
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
    if (replacementValue === null) {
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return path.resolve(
    relativePath.replace(
      /^~(?=$|\/|\\)/,
      `${process.env.HOME || process.env.USERPROFILE}`
    )
  )
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
        '--atx-headers',
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
  const { stdout: exifMetadata } = await execa('exiftool', [
    `${resolvePath(filePath)}`,
  ])

  return compressString(exifMetadata).split(/\s+/).slice(0, numWords).join(' ')
}

export const getPrompt = async (
  config: ConfigType,
  filePath: string,
  replicate: Replicate,
  maxWord: number
): Promise<{
  format: string | undefined;
  mainDir: string | undefined;
  fileExt: string | undefined;
  fileCase: string | undefined;
  prompt: string | undefined;
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
      content = await makePictureCaption(replicate, filePath)
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
      content = await executeExifMetadataExtraction(
        filePath,
        Number(config.MAX_CONTENT_WORDS)
      )
      format = config.OTHERS_FILENAME_FORMAT
      mainDir = resolvePath(
        `${config.BASE_DIRECTORY}/${config.OTHERS_DIRECTORY}`
      )
      fileCase = config.OTHERS_FILE_NAME_CASE

      break
    }
  }

  const extractedPrompts = await extractPrompts(
    String(config.PROMPT_FILE),
    String(format)
  )

  const prompt = generatePrompt(
    filePath,
    String(content),
    exifMetadata,
    mimeType,
    fileCategory,
    extractedPrompts
  )

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
  additionalPrompts: string
): string => {
  return `Without prefacing it with anything, giving explanations or
  justifications, write a JSON object with an insightful but concise information
  for a "${fileName}" file classified as "${mimeType} - ${mimeCategory}" with
  the file contents "${fileContent}". Make sure you double quote the JSON
  properties and values so it is valid JSON.

  ### ${additionalPrompts}`
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
  apiKey: string,
  prompt: string | undefined
): Promise<string | undefined> => {
  // Accounting for GPT-3's input req of 4k tokens (approx 8k chars)
  if (String(prompt).length > 8000) {
    throw new Error('The prompt is too large for the OpenAI API')
  }
  const api = new ChatGPTAPI({
    apiKey
  })

  let res

  if (prompt != null) {
    const message = await api.sendMessage(prompt)
    res = message.text
  }

  return res
}

export async function addTagsToFile (
  file: string,
  tags: string[]
): Promise<void> {
  const platform = process.platform
  const filePath = resolvePath(<string>file)

  switch (platform) {
    case 'darwin':
      // eslint-disable-next-line @typescript-eslint/no-var-requires,no-case-declarations
      const tag = require('osx-tag')

      tag.addTags(filePath, tags, (err: Error) => {
        if (err) throw err
      })
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

export async function addCommentsToFile (
  file: string,
  commentString: string
): Promise<void> {
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
