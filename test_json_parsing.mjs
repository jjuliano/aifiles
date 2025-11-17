import { parseJson } from './dist/utils.js';

// Test cases for enhanced JSON parsing
const testCases = [
  {
    name: 'Markdown code fences',
    input: '```json\n{"title": "Test", "summary": "A test"}\n```',
    expected: { title: 'Test', summary: 'A test' }
  },
  {
    name: 'Quoted JSON',
    input: '"{\\"title\\": \\"Test\\", \\"summary\\": \\"A test\\"}"',
    expected: { title: 'Test', summary: 'A test' }
  },
  {
    name: 'Unquoted keys',
    input: '{title: "Test", summary: "A test"}',
    expected: { title: 'Test', summary: 'A test' }
  },
  {
    name: 'Single quotes',
    input: "{'title': 'Test', 'summary': 'A test'}",
    expected: { title: 'Test', summary: 'A test' }
  },
  {
    name: 'Trailing commas',
    input: '{"title": "Test", "summary": "A test",}',
    expected: { title: 'Test', summary: 'A test' }
  },
  {
    name: 'Python-style booleans',
    input: '{"active": True, "disabled": False}',
    expected: { active: true, disabled: false }
  },
  {
    name: 'Python-style null',
    input: '{"value": None}',
    expected: { value: null }
  },
  {
    name: 'Extra braces',
    input: '{{{"title": "Test"}}}',
    expected: { title: 'Test' }
  },
  {
    name: 'Mixed content with JSON',
    input: 'Here is the JSON response: {"title": "Test"} and some extra text',
    expected: { title: 'Test' }
  },
  {
    name: 'Incomplete JSON with properties',
    input: '"title": "Test", "summary": "A test"',
    expected: { title: 'Test', summary: 'A test' }
  },
  {
    name: 'Array with issues',
    input: '[item1, item2,]',
    expected: ['item1', 'item2']
  }
];

async function runTests() {
  console.log('🧪 Testing Enhanced JSON Parsing\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`);
      console.log(`Input: ${testCase.input}`);

      const result = await parseJson(testCase.input);

      // Simple comparison for our test cases
      const expectedStr = JSON.stringify(testCase.expected);
      const resultStr = JSON.stringify(result);

      if (expectedStr === resultStr) {
        console.log(`✅ PASSED\n`);
        passed++;
      } else {
        console.log(`❌ FAILED`);
        console.log(`Expected: ${expectedStr}`);
        console.log(`Got:      ${resultStr}\n`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
}

runTests().catch(console.error);
