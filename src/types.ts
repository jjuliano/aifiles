// Re-export all types for easy access
export type { LLMProvider, LLMConfig } from './providers/base-provider.js';
export type { FolderTemplate } from './folder-templates.js';

// Configuration types
export interface AIFilesConfig {
  LLM_PROVIDER?: 'openai' | 'grok' | 'deepseek' | 'ollama' | 'lmstudio';
  LLM_MODEL?: string;
  LLM_BASE_URL?: string;
  GROK_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
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
  MUSIC_FILENAME_FORMAT?: string;
  MUSIC_FILE_NAME_CASE?: string;
  PICTURES_FILENAME_FORMAT?: string;
  PICTURES_FILE_NAME_CASE?: string;
  VIDEOS_FILENAME_FORMAT?: string;
  VIDEOS_FILE_NAME_CASE?: string;
  ARCHIVES_FILENAME_FORMAT?: string;
  ARCHIVES_FILE_NAME_CASE?: string;
  OTHERS_FILENAME_FORMAT?: string;
  OTHERS_FILE_NAME_CASE?: string;
  MOVE_FILE_OPERATION?: boolean;
  FIELDS_FILE?: string;
  MAX_MEDIA_DATA_SOURCES?: number;
  MAX_CONTENT_WORDS?: number;
  PROMPT_FOR_REVISION_NUMBER?: boolean;
  PROMPT_FOR_CUSTOM_CONTEXT?: boolean;
  FILE_MANAGER_INDEX_MODE?: 'launch' | 'on-demand';
  ORGANIZATION_TIMEOUT?: number;
  REANALYZE_PROMPT?: string;
  WATCH_MODE_PROMPT?: string;
  ORGANIZATION_PROMPT_TEMPLATE?: string;
  IMAGE_CAPTION_PROMPT?: string;
}

// File operation types
export interface FileAnalysis {
  category: string;
  title: string;
  tags: string[];
  summary: string;
  metadata: Record<string, any>;
}

export interface FileOrganizationResult {
  originalPath: string;
  newPath: string;
  tags: string[];
  summary: string;
  moved: boolean;
}

// Template types
export type FileNameCase = 'snake' | 'kebab' | 'camel' | 'pascal' | 'upper_snake' | 'lower_snake';

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  basePath: string;
  namingStructure: string;
  fileNameCase?: FileNameCase;
  autoOrganize?: boolean;
  watchForChanges?: boolean;
}

// Event types for file watcher
export interface FileDetectedEvent {
  filePath: string;
  fileName: string;
  template: TemplateConfig;
  timestamp: Date;
}

// Provider capabilities
export interface ProviderCapabilities {
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxTokens: number;
  requiresApiKey: boolean;
}

// Error types
export type AIFilesErrorCode =
  | 'CONFIG_ERROR'
  | 'PROVIDER_ERROR'
  | 'FILE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorDetails {
  code: AIFilesErrorCode;
  message: string;
  details?: any;
  stack?: string;
}
