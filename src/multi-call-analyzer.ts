import { generatePromptResponse, parseJson, ConfigType } from './utils.js';
import type { FolderTemplate } from './folder-templates.js';

/**
 * Multi-call file analysis system
 * Makes multiple focused LLM calls to deeply understand a file
 * Each call focuses on a specific aspect for better accuracy
 */

export interface FileAnalysisResult {
  // Basic understanding (Call 1)
  title: string;
  summary: string;
  mainTopic: string;
  contentType: string;

  // Categorization (Call 2)
  category: string;
  subcategories: string[];
  fileType: string;

  // Metadata extraction (Call 3)
  tags: string[];
  dateRelevant?: string;
  people?: string[];
  locations?: string[];
  organizations?: string[];
  keywords: string[];

  // Organization fields (Call 4)
  suggestedPath: string;
  suggestedFilename: string;
  priority?: string;
  confidence: number;

  // Template selection (Call 5)
  selectedTemplateId?: string;
  selectedTemplateName?: string;
  templateConfidence?: number;
  templateReasoning?: string;

  // Folder selection within template (Call 6)
  selectedFolder?: string;
  selectedFolderPath?: string;
  folderConfidence?: number;
  folderReasoning?: string;
}

/**
 * Call 1: Basic Content Understanding
 * Focus: Get high-level understanding of what this file is about
 */
async function analyzeBasicContent(
  config: ConfigType,
  fileName: string,
  fileContent: string,
  mimeType: string | null
): Promise<{
  title: string;
  summary: string;
  mainTopic: string;
  contentType: string;
}> {
  const prompt = `Analyze this file and provide a basic understanding.

FILE NAME: ${fileName}
MIME TYPE: ${mimeType || 'unknown'}
FILE CONTENT:
${fileContent} // Full content provided for maximum context

Focus on:
1. What is this file about? (1-2 sentence summary)
2. What would be a clear, descriptive title for this file?
3. What is the main topic or subject matter?
4. What type of content is this? (report, image, code, data, media, etc.)

Return ONLY valid JSON with these exact fields:
{
  "title": "clear descriptive title",
  "summary": "1-2 sentence summary",
  "mainTopic": "primary subject matter",
  "contentType": "type of content"
}

IMPORTANT:
- Start with { and end with }
- No explanations, just the JSON
- No markdown code blocks
- Double quote all strings`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get basic content analysis');
      }

      const result = await parseJson(response);

      // Validate required fields for basic content analysis
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.title || typeof result.title !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "title" field');
      }
      if (!result.summary || typeof result.summary !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "summary" field');
      }
      if (!result.mainTopic || typeof result.mainTopic !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "mainTopic" field');
      }
      if (!result.contentType || typeof result.contentType !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "contentType" field');
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        // Show detailed error information
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get basic content analysis after 10 attempts');
}

/**
 * Call 2: Detailed Categorization
 * Focus: Determine precise category and subcategories
 * Uses information from Call 1 to make better decisions
 */
async function analyzeCategorization(
  config: ConfigType,
  fileName: string,
  basicAnalysis: {
    title: string;
    summary: string;
    mainTopic: string;
    contentType: string;
  },
  mimeType: string | null
): Promise<{
  category: string;
  subcategories: string[];
  fileType: string;
}> {
  const prompt = `Based on previous analysis, determine the precise categorization for this file.

FILE NAME: ${fileName}
MIME TYPE: ${mimeType || 'unknown'}
TITLE: ${basicAnalysis.title}
SUMMARY: ${basicAnalysis.summary}
MAIN TOPIC: ${basicAnalysis.mainTopic}
CONTENT TYPE: ${basicAnalysis.contentType}

Focus on:
1. What is the PRIMARY category? (Documents, Images, Videos, Audio, Code, Data, Archives, Research, etc.)
2. What are 2-4 subcategories that apply? (be specific: research/academic, photos/vacation, code/python, documents/reports, etc.)
3. What specific file type is this? (research-paper, invoice, screenshot, tutorial, dataset, etc.)

Return ONLY valid JSON with these exact fields:
{
  "category": "primary category (e.g., Documents, Research, Images)",
  "subcategories": ["subcategory1", "subcategory2 (e.g., academic, papers, research)"],
  "fileType": "specific type (e.g., research-paper, article, report)"
}

IMPORTANT:
- Start with { and end with }
- No explanations, just the JSON
- No markdown code blocks
- Subcategories must be an array of strings`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get categorization analysis');
      }

      const result = await parseJson(response);

      // Validate required fields for categorization
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.category || typeof result.category !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "category" field');
      }
      if (!result.subcategories || !Array.isArray(result.subcategories)) {
        throw new Error('Invalid JSON response: missing or invalid "subcategories" field');
      }
      if (!result.fileType || typeof result.fileType !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "fileType" field');
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get categorization analysis after 10 attempts');
}

/**
 * Call 3: Metadata Extraction
 * Focus: Extract all relevant metadata and entities
 * Uses previous analysis to guide extraction
 */
async function analyzeMetadata(
  config: ConfigType,
  fileName: string,
  fileContent: string,
  basicAnalysis: {
    title: string;
    summary: string;
    mainTopic: string;
  },
  categorization: {
    category: string;
    fileType: string;
  }
): Promise<{
  tags: string[];
  dateRelevant?: string;
  people?: string[];
  locations?: string[];
  organizations?: string[];
  keywords: string[];
}> {
  const prompt = `Extract all relevant metadata from this file.

FILE NAME: ${fileName}
TITLE: ${basicAnalysis.title}
CATEGORY: ${categorization.category}
FILE TYPE: ${categorization.fileType}
MAIN TOPIC: ${basicAnalysis.mainTopic}

FILE CONTENT:
${fileContent} // Full content provided for maximum context

Focus on extracting:
1. Relevant tags (5-10 descriptive keywords)
2. Any important dates mentioned (return most relevant one in YYYY-MM-DD format if found)
3. Names of people mentioned (if any)
4. Locations mentioned (if any)
5. Organizations/companies mentioned (if any)
6. Key technical keywords or concepts (5-10 words)

Return ONLY valid JSON with these exact fields:
{
  "tags": ["tag1", "tag2", "tag3"],
  "dateRelevant": "YYYY-MM-DD or null",
  "people": ["person1", "person2"] or null,
  "locations": ["location1"] or null,
  "organizations": ["org1"] or null,
  "keywords": ["keyword1", "keyword2"]
}

IMPORTANT:
- Start with { and end with }
- No explanations, just the JSON
- No markdown code blocks
- All arrays and strings must be properly quoted
- Use null for fields with no data`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get metadata analysis');
      }

      const result = await parseJson(response);

      // Validate required fields for metadata
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.tags || !Array.isArray(result.tags)) {
        throw new Error('Invalid JSON response: missing or invalid "tags" field');
      }
      if (!result.keywords || !Array.isArray(result.keywords)) {
        throw new Error('Invalid JSON response: missing or invalid "keywords" field');
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get metadata analysis after 10 attempts');
}

/**
 * Call 4: Organization Recommendation
 * Focus: Suggest final organization based on all previous analysis
 * This call sees everything and makes the final decision
 */
async function analyzeOrganization(
  config: ConfigType,
  fileName: string,
  basicAnalysis: {
    title: string;
    summary: string;
    mainTopic: string;
  },
  categorization: {
    category: string;
    subcategories: string[];
    fileType: string;
  },
  metadata: {
    tags: string[];
    dateRelevant?: string;
    keywords: string[];
  }
): Promise<{
  suggestedPath: string;
  suggestedFilename: string;
  priority?: string;
  confidence: number;
}> {
  const prompt = `Based on complete analysis, recommend organization for this file.

ORIGINAL FILE NAME: ${fileName}

COMPLETE ANALYSIS:
Title: ${basicAnalysis.title}
Summary: ${basicAnalysis.summary}
Main Topic: ${basicAnalysis.mainTopic}
Category: ${categorization.category}
Subcategories: ${categorization.subcategories.join(', ')}
File Type: ${categorization.fileType}
Tags: ${metadata.tags.join(', ')}
${metadata.dateRelevant ? `Date: ${metadata.dateRelevant}` : ''}
Keywords: ${metadata.keywords.join(', ')}

Focus on:
1. Suggest a clear folder path (e.g., "Documents/Reports/Financial")
2. Suggest an improved filename (keep extension, make it descriptive)
3. What's the priority? (high, medium, low)
4. How confident are you in this organization? (0.0 to 1.0)

Return ONLY valid JSON with these exact fields:
{
  "suggestedPath": "Category/Subcategory/Subfolder",
  "suggestedFilename": "descriptive-filename.ext",
  "priority": "high|medium|low",
  "confidence": 0.85
}

IMPORTANT:
- Start with { and end with }
- No explanations, just the JSON
- No markdown code blocks
- confidence must be a number between 0 and 1`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get organization recommendation');
      }

      const result = await parseJson(response);

      // Validate required fields for organization
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.suggestedPath || typeof result.suggestedPath !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "suggestedPath" field');
      }
      if (!result.suggestedFilename || typeof result.suggestedFilename !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "suggestedFilename" field');
      }
      if (result.confidence === undefined || typeof result.confidence !== 'number') {
        throw new Error('Invalid JSON response: missing or invalid "confidence" field');
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get organization recommendation after 10 attempts');
}

/**
 * Call 5: Template Selection
 * Focus: Select the best folder template based on complete analysis
 * Uses all previous analysis to match with available templates
 */
async function selectTemplate(
  config: ConfigType,
  templates: FolderTemplate[],
  basicAnalysis: {
    title: string;
    summary: string;
    mainTopic: string;
    contentType: string;
  },
  categorization: {
    category: string;
    subcategories: string[];
    fileType: string;
  },
  metadata: {
    tags: string[];
    keywords: string[];
  },
  organization: {
    suggestedPath: string;
    suggestedFilename: string;
  }
): Promise<{
  selectedTemplateId: string;
  selectedTemplateName: string;
  templateConfidence: number;
  templateReasoning: string;
}> {
  // Build template descriptions for the LLM
  const templateDescriptions = templates
    .map(
      (t, index) =>
        `TEMPLATE ${index + 1}:
   ID: ${t.id}
   Name: ${t.name}
   Description: ${t.description}
   Base Path: ${t.basePath}
   Naming Structure: ${t.namingStructure}
   ${t.folderStructure ? `Has ${t.folderStructure.length} predefined folders` : 'No predefined structure'}`
    )
    .join('\n\n');

  const prompt = `Based on complete file analysis, select the best folder template.

FILE ANALYSIS:
Title: ${basicAnalysis.title}
Summary: ${basicAnalysis.summary}
Main Topic: ${basicAnalysis.mainTopic}
Content Type: ${basicAnalysis.contentType}
Category: ${categorization.category}
Subcategories: ${categorization.subcategories.join(', ')}
File Type: ${categorization.fileType}
Tags: ${metadata.tags.join(', ')}
Keywords: ${metadata.keywords.join(', ')}
Suggested Path: ${organization.suggestedPath}
Suggested Filename: ${organization.suggestedFilename}

AVAILABLE TEMPLATES:
${templateDescriptions}

Focus on:
1. Which template best matches this file's category and purpose?
2. Does the template's base path and structure align with the suggested organization?
3. Would the template's naming structure work well for this file?
4. How confident are you in this template selection? (0.0 to 1.0)
5. Why is this the best template for this file?

Return ONLY valid JSON with these exact fields. DO NOT include any text before or after the JSON:
{
  "selectedTemplateId": "template-id",
  "selectedTemplateName": "Template Name",
  "templateConfidence": 0.85,
  "templateReasoning": "Brief explanation of why this template is the best match"
}

CRITICAL REQUIREMENTS:
- Response must START with { and END with }
- NO introductory text like "Based on the analysis:" or "I recommend:"
- NO explanations outside the JSON object
- NO markdown formatting or code blocks
- templateConfidence must be a number between 0.0 and 1.0
- selectedTemplateId must be the EXACT ID value (like "documents", "downloads") from the "ID:" field above, NOT the template number
- selectedTemplateName must match the corresponding template name from the "Name:" field
- Do NOT use numbers like "1", "2", "3" as the selectedTemplateId - use the actual template ID string`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get template selection');
      }

      const result = await parseJson(response);

      // Validate required fields for template selection
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.selectedTemplateId || typeof result.selectedTemplateId !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "selectedTemplateId" field');
      }
      if (!result.selectedTemplateName || typeof result.selectedTemplateName !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "selectedTemplateName" field');
      }
      if (result.templateConfidence === undefined || typeof result.templateConfidence !== 'number') {
        throw new Error('Invalid JSON response: missing or invalid "templateConfidence" field');
      }
      if (!result.templateReasoning || typeof result.templateReasoning !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "templateReasoning" field');
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get template selection after 10 attempts');
}

/**
 * Call 6: Folder Selection within Template
 * When a template is selected, choose the best folder from its predefined structure
 */
async function selectFolderFromTemplate(
  config: ConfigType,
  fileName: string,
  basicAnalysis: {
    title: string;
    summary: string;
    mainTopic: string;
    contentType: string;
  },
  categorization: {
    category: string;
    subcategories: string[];
    fileType: string;
  },
  metadata: {
    tags: string[];
    keywords: string[];
  },
  organization: {
    suggestedPath: string;
    suggestedFilename: string;
  },
  selectedTemplate: FolderTemplate
): Promise<{
  selectedFolder: string;
  selectedFolderPath: string;
  folderConfidence: number;
  folderReasoning: string;
}> {
  // Build folder descriptions for the LLM
  const folderDescriptions = selectedTemplate.folderStructure
    ?.map((folder, index) => {
      const folderPath = folder.replace(/^\.\//, '');
      const folderParts = folderPath.split('/').filter(p => p);
      const folderName = folderParts[folderParts.length - 1];
      const depth = folderParts.length;

      return `FOLDER ${index + 1}:
   Path: ${folderPath}
   Name: ${folderName}
   Depth: ${depth} level${depth === 1 ? '' : 's'}
   Full Path: ${selectedTemplate.basePath}/${folderPath}`;
    })
    .join('\n\n') || 'No folders available';

  const isEnforced = selectedTemplate.enforceTemplateStructure === true;

  const prompt = `Based on the file analysis, ${isEnforced ? 'select the best folder from the template\'s predefined structure' : 'determine the optimal folder path within the template structure'}.

FILE ANALYSIS:
Title: ${basicAnalysis.title}
Summary: ${basicAnalysis.summary}
Main Topic: ${basicAnalysis.mainTopic}
Content Type: ${basicAnalysis.contentType}
Category: ${categorization.category}
Subcategories: ${categorization.subcategories.join(', ')}
File Type: ${categorization.fileType}
Tags: ${metadata.tags.join(', ')}
Keywords: ${metadata.keywords.join(', ')}
Suggested Path: ${organization.suggestedPath}
Suggested Filename: ${organization.suggestedFilename}

SELECTED TEMPLATE: ${selectedTemplate.name} (${selectedTemplate.id})
Base Path: ${selectedTemplate.basePath}
Naming Structure: ${selectedTemplate.namingStructure}
${isEnforced ? 'ENFORCED STRUCTURE: Files must go directly into selected predefined folders' : 'FLEXIBLE STRUCTURE: You can create subcategories within selected folders'}

AVAILABLE FOLDERS IN TEMPLATE:
${folderDescriptions}

${isEnforced ? `Choose the SINGLE best folder for this file from the predefined options above. The file will be placed directly in this folder.

Consider:
1. Which folder semantically matches the file's category and content?
2. How well does the folder name align with the file's purpose and topic?
3. Would this folder be the natural place someone would look for this file?
4. How confident are you in this folder selection? (0.0 to 1.0)
5. Why is this folder the best choice for this specific file?

CRITICAL CONSTRAINTS:
- You MUST ONLY choose from the folders listed in "AVAILABLE FOLDERS IN TEMPLATE"
- You are FORBIDDEN from suggesting or creating ANY new folder names not in that exact list
- You are FORBIDDEN from modifying or extending the predefined folder paths
- If none of the available folders seem appropriate, you MUST still choose the closest match from the list
- Any attempt to suggest folders outside this list will be considered an ERROR` : `Determine the optimal folder path for this file within the template structure. You can either select a predefined folder OR create a subcategory within one.

Consider:
1. Should this file go directly into one of the predefined folders, or would a subcategory be more appropriate?
2. Which predefined folder would be the best starting point for this file's category?
3. If creating a subcategory, what would be a logical and descriptive subfolder name?
4. How well does your chosen path align with the file's purpose and content?
5. How confident are you in this folder path? (0.0 to 1.0)
6. Why is this path the best choice for this specific file?

FLEXIBLE OPTIONS:
- Select any folder from the "AVAILABLE FOLDERS IN TEMPLATE" list
- Create subcategories by extending paths (e.g., "Reports/Financial/2024" from "Reports/Financial")
- Your final path should be logical and follow standard organizational practices`}

Return ONLY valid JSON with these exact fields. DO NOT include any text before or after the JSON:
{
  "selectedFolder": "${isEnforced ? 'folder-name' : 'folder/path'}",
  "selectedFolderPath": "${isEnforced ? 'full/path/to/folder' : 'full/path/to/folder/or/subcategory'}",
  "folderConfidence": 0.85,
  "folderReasoning": "Brief explanation of why this path is the best match"
}

CRITICAL REQUIREMENTS:
- Response must START with { and END with }
- NO introductory text like "Based on the analysis:" or "I recommend:"
- NO explanations outside the JSON object
- NO markdown formatting or code blocks
- folderConfidence must be a number between 0.0 and 1.0
- selectedFolder must be ${isEnforced ? 'just the folder name (e.g., "Contracts", "Reports/Financial")' : 'the folder path (e.g., "Contracts", "Reports/Financial/2024")'}
- selectedFolderPath must be the full relative path ${isEnforced ? '(e.g., "Contracts", "Reports/Financial")' : '(e.g., "Contracts", "Reports/Financial/2024", "Projects/Client-Work/Proposal")'}
- Do NOT include the base path in selectedFolderPath - just the relative folder path`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get folder selection');
      }

      const result = await parseJson(response);

      // Validate required fields for folder selection
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.selectedFolder || typeof result.selectedFolder !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "selectedFolder" field');
      }
      if (!result.selectedFolderPath || typeof result.selectedFolderPath !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "selectedFolderPath" field');
      }
      if (result.folderConfidence === undefined || typeof result.folderConfidence !== 'number') {
        throw new Error('Invalid JSON response: missing or invalid "folderConfidence" field');
      }
      if (!result.folderReasoning || typeof result.folderReasoning !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "folderReasoning" field');
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get folder selection after 10 attempts');
}

/**
 * Single-call analysis: Analyze file with one comprehensive LLM call
 * Provides basic organization recommendations in a single request
 */
export async function analyzeFileSingleCall(
  config: ConfigType,
  fileName: string,
  fileContent: string,
  mimeType: string | null,
  templates?: FolderTemplate[]
): Promise<FileAnalysisResult> {
  // Single comprehensive prompt that covers all analysis aspects
  const prompt = `Analyze this file and provide organization recommendations. Focus on understanding the content and suggesting appropriate categorization and naming.

FILE: ${fileName}
CONTENT:
${fileContent} // Full content provided for maximum context

Return ONLY valid JSON with these exact fields:
{
  "title": "clear descriptive title for the file",
  "summary": "brief 1-2 sentence summary of the content",
  "mainTopic": "primary subject matter",
  "contentType": "document|report|article|note|email|etc",
  "category": "broad category like Documents, Images, etc",
  "subcategories": ["specific", "subcategories", "as", "array"],
  "fileType": "${mimeType || 'unknown'}",
  "tags": ["relevant", "tags", "for", "organization"],
  "keywords": ["important", "keywords", "from", "content"],
  "suggestedPath": "recommended/folder/structure",
  "suggestedFilename": "recommended-filename.ext",
  "confidence": 0.85
}

IMPORTANT:
- Start with { and end with }
- No explanations outside the JSON
- No markdown code blocks
- confidence must be a number between 0 and 1`;

  // Retry up to 10 times on JSON parse failure
  let lastError: Error | undefined;
  const errorHistory: Array<{ attempt: number; response: string; error: string }> = [];

  for (let attempt = 1; attempt <= 10; attempt++) {
    let response: string | undefined;
    try {
      // Build retry prompt with accumulated error history
      let retryPrompt = prompt;
      if (errorHistory.length > 0) {
        retryPrompt = `${prompt}

PREVIOUS ATTEMPTS FAILED (${errorHistory.length} attempts):
${errorHistory.map((h, idx) => `
--- Attempt ${h.attempt} ---
Response: ${h.response.substring(0, 150)}${h.response.length > 150 ? '...' : ''}
Error: ${h.error}
`).join('\n')}

Please fix ALL the issues from previous attempts. Make sure to:
1. Return ONLY valid JSON (start with { and end with })
2. Do not include any markdown, code blocks, or explanatory text
3. Ensure all required fields are present and have the correct types
4. Double-quote all strings properly`;
      }

      response = await generatePromptResponse(config, retryPrompt);
      if (!response) {
        throw new Error('Failed to get single-call analysis');
      }

      const result = await parseJson(response);

      // Validate required fields for single-call analysis
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON response: not an object');
      }
      if (!result.title || typeof result.title !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "title" field');
      }
      if (!result.summary || typeof result.summary !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "summary" field');
      }
      if (!result.category || typeof result.category !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "category" field');
      }
      if (!result.suggestedPath || typeof result.suggestedPath !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "suggestedPath" field');
      }
      if (!result.suggestedFilename || typeof result.suggestedFilename !== 'string') {
        throw new Error('Invalid JSON response: missing or invalid "suggestedFilename" field');
      }

      // Ensure arrays exist
      result.subcategories = Array.isArray(result.subcategories) ? result.subcategories : [];
      result.tags = Array.isArray(result.tags) ? result.tags : [];
      result.keywords = Array.isArray(result.keywords) ? result.keywords : [];

      // Add missing fields that multi-call provides
      result.mainTopic = result.mainTopic || result.category;
      result.contentType = result.contentType || 'document';
      result.fileType = result.fileType || mimeType || 'unknown';
      result.confidence = typeof result.confidence === 'number' ? result.confidence : 0.8;

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Add to error history
      if (response) {
        errorHistory.push({
          attempt,
          response,
          error: lastError.message
        });
      }

      if (attempt < 10) {
        console.log(`     ⚠️  Parse error on attempt ${attempt}/10`);
        console.log(`     📄 Raw LLM output: ${response?.substring(0, 200)}${(response?.length || 0) > 200 ? '...' : ''}`);
        console.log(`     ❌ Error: ${lastError.message}`);

        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      }
    }
  }

  throw lastError || new Error('Failed to get single-call analysis after 10 attempts');
}

/**
 * Main function: Analyze file with multiple LLM calls
 * Makes 5 focused calls to deeply understand the file
 * Each call builds on previous knowledge
 */
export async function analyzeFileMultiCall(
  config: ConfigType,
  fileName: string,
  fileContent: string,
  mimeType: string | null,
  templates?: FolderTemplate[]
): Promise<FileAnalysisResult> {
  // Determine total calls based on whether we need folder selection
  let willDoFolderSelection = false;
  if (templates && templates.length > 0) {
    // We'll do template selection (Call 5), and potentially folder selection (Call 6)
    // We can't know yet if we'll do Call 6 until we select the template
    willDoFolderSelection = true; // Assume we might need it
  }
  const totalCalls = templates && templates.length > 0 ? 6 : 4; // Reserve slot for Call 6

  console.log('🔍 Starting multi-call analysis...');

  // Call 1: Basic understanding
  console.log(`  📝 Call 1/${totalCalls}: Analyzing basic content...`);
  const basicAnalysis = await analyzeBasicContent(config, fileName, fileContent, mimeType);
  console.log(`     ✓ Title: ${basicAnalysis.title}`);

  // Call 2: Categorization
  console.log(`  📁 Call 2/${totalCalls}: Determining categorization...`);
  const categorization = await analyzeCategorization(config, fileName, basicAnalysis, mimeType);
  console.log(`     ✓ Category: ${categorization.category} → ${categorization.subcategories.join(', ')}`);

  // Call 3: Metadata extraction
  console.log(`  🏷️  Call 3/${totalCalls}: Extracting metadata...`);
  const metadata = await analyzeMetadata(config, fileName, fileContent, basicAnalysis, categorization);
  console.log(`     ✓ Found ${metadata.tags.length} tags, ${metadata.keywords.length} keywords`);

  // Call 4: Organization recommendation
  console.log(`  🎯 Call 4/${totalCalls}: Generating organization recommendations...`);
  const organization = await analyzeOrganization(config, fileName, basicAnalysis, categorization, metadata);
  console.log(`     ✓ Suggested: ${organization.suggestedPath}/${organization.suggestedFilename}`);
  console.log(`     ✓ Confidence: ${(organization.confidence * 100).toFixed(0)}%`);

  // Call 5: Template selection (optional, if templates provided)
  let templateSelection: {
    selectedTemplateId?: string;
    selectedTemplateName?: string;
    templateConfidence?: number;
    templateReasoning?: string;
  } = {};

  if (templates && templates.length > 0) {
    console.log(`  📋 Call 5/${totalCalls}: Selecting best folder template...`);
    const selection = await selectTemplate(config, templates, basicAnalysis, categorization, metadata, organization);
    templateSelection = {
      selectedTemplateId: selection.selectedTemplateId,
      selectedTemplateName: selection.selectedTemplateName,
      templateConfidence: selection.templateConfidence,
      templateReasoning: selection.templateReasoning,
    };
    console.log(`     ✓ Selected: ${selection.selectedTemplateName} (${(selection.templateConfidence * 100).toFixed(0)}%)`);
    console.log(`     ✓ Reason: ${selection.templateReasoning}`);
  }

  // Call 6: Folder selection within template (optional, if template has folder structure)
  let folderSelection: {
    selectedFolder?: string;
    selectedFolderPath?: string;
    folderConfidence?: number;
    folderReasoning?: string;
  } = {};

  if (templates && templates.length > 0 && templateSelection.selectedTemplateId) {
    const selectedTemplate = templates.find(t => t.id === templateSelection.selectedTemplateId);
    if (selectedTemplate && selectedTemplate.folderStructure && selectedTemplate.folderStructure.length > 0) {
      console.log(`  📂 Call 6/${totalCalls}: Selecting best folder within template...`);
      const selection = await selectFolderFromTemplate(
        config,
        fileName,
        basicAnalysis,
        categorization,
        metadata,
        organization,
        selectedTemplate
      );
      folderSelection = {
        selectedFolder: selection.selectedFolder,
        selectedFolderPath: selection.selectedFolderPath,
        folderConfidence: selection.folderConfidence,
        folderReasoning: selection.folderReasoning,
      };
      console.log(`     ✓ Selected folder: ${selection.selectedFolderPath} (${(selection.folderConfidence * 100).toFixed(0)}%)`);
      console.log(`     ✓ Reason: ${selection.folderReasoning}`);
    }
  }

  // Combine all results
  return {
    ...basicAnalysis,
    ...categorization,
    ...metadata,
    ...organization,
    ...templateSelection,
    ...folderSelection,
  };
}

/**
 * Helper: Format analysis result for display
 */
export function formatAnalysisResult(result: FileAnalysisResult): string {
  return `
╔═══════════════════════════════════════════════════════════════
║ FILE ANALYSIS RESULTS
╠═══════════════════════════════════════════════════════════════
║
║ BASIC UNDERSTANDING:
║   Title: ${result.title}
║   Summary: ${result.summary}
║   Main Topic: ${result.mainTopic}
║   Content Type: ${result.contentType}
║
║ CATEGORIZATION:
║   Category: ${result.category}
║   Subcategories: ${result.subcategories.join(', ')}
║   File Type: ${result.fileType}
║
║ METADATA:
║   Tags: ${result.tags.join(', ')}
${result.dateRelevant ? `║   Date: ${result.dateRelevant}` : ''}
${result.people && result.people.length > 0 ? `║   People: ${result.people.join(', ')}` : ''}
${result.locations && result.locations.length > 0 ? `║   Locations: ${result.locations.join(', ')}` : ''}
${result.organizations && result.organizations.length > 0 ? `║   Organizations: ${result.organizations.join(', ')}` : ''}
║   Keywords: ${result.keywords.join(', ')}
║
║ ORGANIZATION:
║   Path: ${result.suggestedPath}
║   Filename: ${result.suggestedFilename}
║   Priority: ${result.priority || 'medium'}
║   Confidence: ${(result.confidence * 100).toFixed(0)}%
║
${result.selectedTemplateId ? `║ TEMPLATE SELECTION:
║   Selected Template: ${result.selectedTemplateName} (ID: ${result.selectedTemplateId})
║   Template Confidence: ${result.templateConfidence ? (result.templateConfidence * 100).toFixed(0) : 'N/A'}%
║   Reasoning: ${result.templateReasoning || 'N/A'}
║
${result.selectedFolder ? `║ FOLDER SELECTION:
║   Selected Folder: ${result.selectedFolder}
║   Folder Path: ${result.selectedFolderPath}
║   Folder Confidence: ${result.folderConfidence ? (result.folderConfidence * 100).toFixed(0) : 'N/A'}%
║   Reasoning: ${result.folderReasoning || 'N/A'}
║
` : ''}` : ''}╚═══════════════════════════════════════════════════════════════
`.trim();
}
