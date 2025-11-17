// Simple test of the mapping logic without importing TypeScript files
import path from 'path';

// Simulate the folder structures from the templates
const documentsStructure = [
  './Reports',
  './Reports/Financial',
  './Reports/Business',
  './Reports/Personal',
  './Contracts',
  './Invoices',
  './Letters',
  './Forms',
  './Receipts',
  './Certificates',
  './References',
  './Templates',
  './Archives',
];

const downloadsStructure = [
  './Documents',
  './Images',
  './Videos',
  './Audio',
  './Archives',
  './Software',
  './Installers',
  './Temporary',
];

// Simplified version of the mapping logic
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i] + 1,     // deletion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

function mapToFolderStructure(folderStructure, aiCategory) {
  const aiMainCategory = aiCategory.toLowerCase();

  // Look for exact matches
  const exactMatch = folderStructure.find(folder => {
    const folderPath = folder.replace(/^\.\//, '');
    const folderParts = folderPath.split('/').filter(p => p);
    return folderParts.length > 0 && folderParts[0].toLowerCase() === aiMainCategory;
  });

  if (exactMatch) {
    return exactMatch.replace(/^\.\//, '');
  }

  // Look for fuzzy matches
  const fuzzyMatches = folderStructure
    .map(folder => {
      const folderPath = folder.replace(/^\.\//, '');
      const folderParts = folderPath.split('/').filter(p => p);
      if (folderParts.length === 0) return null;

      const folderMain = folderParts[0].toLowerCase();
      const similarity = calculateSimilarity(aiMainCategory, folderMain);
      return { folder: folderPath, similarity, depth: folderParts.length };
    })
    .filter(match => match && match.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity || a.depth - b.depth);

  if (fuzzyMatches.length > 0) {
    return fuzzyMatches[0].folder;
  }

  // Fallback to first folder
  if (folderStructure.length > 0) {
    return folderStructure[0].replace(/^\.\//, '');
  }

  return aiCategory;
}

// Test with documents template
console.log('🧪 Testing Folder Mapping Logic\n');

console.log('📁 Documents Template:');
documentsStructure.forEach(folder => console.log(`  ${folder}`));
console.log();

const docTests = [
  'contracts',
  'invoices',
  'financial-reports',
  'business-reports',
  'receipts',
  'letters',
  'certificates',
  'legal-documents',
  'tax-forms',
  'unknown-docs'
];

console.log('📋 Documents Mapping Results:');
docTests.forEach(aiCategory => {
  const mapped = mapToFolderStructure(documentsStructure, aiCategory);
  console.log(`  "${aiCategory}" → "${mapped}"`);
});
console.log();

console.log('📁 Downloads Template:');
downloadsStructure.forEach(folder => console.log(`  ${folder}`));
console.log();

const downloadTests = [
  'documents',
  'images',
  'videos',
  'audio',
  'archives',
  'software',
  'installers',
  'pictures',
  'music',
  'movies',
  'photos',
  'songs',
  'apps',
  'zips'
];

console.log('📋 Downloads Mapping Results:');
downloadTests.forEach(aiCategory => {
  const mapped = mapToFolderStructure(downloadsStructure, aiCategory);
  console.log(`  "${aiCategory}" → "${mapped}"`);
});

console.log('\n✅ Test completed!');
