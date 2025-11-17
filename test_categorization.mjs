import { generatePromptResponse, parseJson } from './src/utils.js';

// Test the categorization logic with the research paper example
async function testCategorization() {
  const config = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY
  };

  const fileName = 'research-paper.md';
  const mimeType = 'text/markdown';

  const basicAnalysis = {
    title: 'Research paper about AI applications in healthcare and medical diagnosis',
    summary: 'This is a research paper exploring the applications of artificial intelligence in healthcare and medical diagnosis.',
    mainTopic: 'AI applications in healthcare',
    contentType: 'research paper'
  };

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

  try {
    console.log('Testing categorization prompt...');
    console.log('Prompt:', prompt);
    console.log('\n---\n');

    const response = await generatePromptResponse(config, prompt);
    console.log('AI Response:', response);

    if (response) {
      const result = await parseJson(response);
      console.log('Parsed result:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testCategorization();

