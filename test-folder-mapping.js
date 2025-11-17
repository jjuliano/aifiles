// Test the folder mapping logic with real templates
import { FolderTemplateManager } from './src/folder-templates.js';
import path from 'path';

async function testRealTemplates() {
  const manager = new FolderTemplateManager();

  // Load the default templates
  const templates = manager.getDefaultTemplates();

  // Test with the "documents" template
  const documentsTemplate = templates.find(t => t.id === 'documents');
  const downloadsTemplate = templates.find(t => t.id === 'downloads');

  console.log('Testing folder mapping with real templates...\n');

  // Test cases for documents template
  if (documentsTemplate) {
    console.log('📁 Documents Template Folder Structure:');
    documentsTemplate.folderStructure.forEach(folder => console.log(`  ${folder}`));
    console.log();

    const docTestCases = [
      { aiCategory: 'contracts', expected: 'Contracts' },
      { aiCategory: 'invoices', expected: 'Invoices' },
      { aiCategory: 'financial-reports', expected: 'Reports/Financial' },
      { aiCategory: 'business-reports', expected: 'Reports/Business' },
      { aiCategory: 'receipts', expected: 'Receipts' },
      { aiCategory: 'letters', expected: 'Letters' },
      { aiCategory: 'certificates', expected: 'Certificates' },
      { aiCategory: 'unknown-docs', expected: 'Reports (fallback)' }
    ];

    console.log('📋 Documents Template Test Cases:');
    docTestCases.forEach(testCase => {
      // Simulate AI-generated path
      const aiPath = path.join(documentsTemplate.basePath, testCase.aiCategory, 'test-file.pdf');

      // Apply mapping
      const mappedPath = manager.mapPathToFolderStructure(documentsTemplate, aiPath);
      const relativePath = path.relative(documentsTemplate.basePath, mappedPath);

      console.log(`  "${testCase.aiCategory}" → "${relativePath}" (expected: ${testCase.expected})`);
    });
    console.log();
  }

  // Test cases for downloads template
  if (downloadsTemplate) {
    console.log('📁 Downloads Template Folder Structure:');
    downloadsTemplate.folderStructure.forEach(folder => console.log(`  ${folder}`));
    console.log();

    const downloadTestCases = [
      { aiCategory: 'documents', expected: 'Documents' },
      { aiCategory: 'images', expected: 'Images' },
      { aiCategory: 'videos', expected: 'Videos' },
      { aiCategory: 'audio', expected: 'Audio' },
      { aiCategory: 'archives', expected: 'Archives' },
      { aiCategory: 'software', expected: 'Software' },
      { aiCategory: 'installers', expected: 'Installers' },
      { aiCategory: 'temp-files', expected: 'Temporary' },
      { aiCategory: 'pictures', expected: 'Images (fuzzy match)' },
      { aiCategory: 'music', expected: 'Audio (fuzzy match)' }
    ];

    console.log('📋 Downloads Template Test Cases:');
    downloadTestCases.forEach(testCase => {
      // Simulate AI-generated path
      const aiPath = path.join(downloadsTemplate.basePath, testCase.aiCategory, 'test-file.pdf');

      // Apply mapping
      const mappedPath = manager.mapPathToFolderStructure(downloadsTemplate, aiPath);
      const relativePath = path.relative(downloadsTemplate.basePath, mappedPath);

      console.log(`  "${testCase.aiCategory}" → "${relativePath}" (expected: ${testCase.expected})`);
    });
    console.log();
  }

  console.log('✅ Test completed!');
}

testRealTemplates().catch(console.error);
