# Multi-Call LLM Analysis

AIFiles now supports **deep file analysis** using multiple focused LLM calls. This approach provides significantly better accuracy and understanding compared to single-call analysis.

## Why Multi-Call Analysis?

Traditional file organization systems make ONE call to the LLM with all information at once. This can lead to:

- Information overload for the model
- Less focused analysis
- Lower accuracy in categorization
- Missing important metadata

**Multi-call analysis** breaks down the analysis into **4 focused calls**, where each call:

1. Focuses on a specific aspect of the file
2. Builds upon previous analysis
3. Provides more detailed and accurate results
4. Ensures the LLM has deep understanding of the file

## The 4-Call Process

### Call 1: Basic Content Understanding 📝
**Focus:** Get high-level understanding

Analyzes:
- What is this file about?
- What would be a clear title?
- What's the main topic?
- What type of content is it?

**Output:**
```json
{
  "title": "Q4 2024 Financial Report",
  "summary": "Quarterly financial analysis for TechCorp Inc",
  "mainTopic": "Financial Performance",
  "contentType": "financial report"
}
```

### Call 2: Detailed Categorization 📁
**Focus:** Determine precise category and subcategories

Uses information from Call 1 to make better decisions.

Analyzes:
- Primary category
- 2-4 specific subcategories
- Specific file type

**Output:**
```json
{
  "category": "Documents",
  "subcategories": ["Financial Reports", "Reports"],
  "fileType": "quarterly report"
}
```

### Call 3: Metadata Extraction 🏷️
**Focus:** Extract all relevant metadata

Uses previous analysis to guide extraction.

Analyzes:
- Relevant tags (5-10 keywords)
- Important dates
- People mentioned
- Locations
- Organizations
- Technical keywords

**Output:**
```json
{
  "tags": ["financial report", "techcorp inc", "q4 2024"],
  "dateRelevant": "2024-12-15",
  "people": ["Sarah Johnson", "Michael Chen"],
  "locations": ["San Francisco, CA"],
  "organizations": ["TechCorp Inc", "Microsoft", "Amazon", "Google"],
  "keywords": ["revenue", "profit margin", "customer growth", "saas", "consulting"]
}
```

### Call 4: Organization Recommendation 🎯
**Focus:** Final organization based on complete analysis

Sees everything from previous calls and makes final decision.

Analyzes:
- Suggested folder path
- Improved filename
- Priority level
- Confidence score

**Output:**
```json
{
  "suggestedPath": "Documents/Reports/Financial",
  "suggestedFilename": "Q4-2024-financial-report-techcorp.md",
  "priority": "high",
  "confidence": 0.85
}
```

## Usage

### Command Line

```bash
# Analyze a file with deep multi-call analysis
aifiles analyze-deep document.pdf

# Analyze a markdown file
aifiles analyze-deep report.md

# Analyze any text-based file
aifiles analyze-deep code.js
```

### Example Output

```
🔬 AIFiles Deep Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyzing: q4-financial-report.md

🔍 Starting multi-call analysis...
  📝 Call 1/4: Analyzing basic content...
     ✓ Title: Q4 2024 Financial Report
  📁 Call 2/4: Determining categorization...
     ✓ Category: Documents → Financial Reports, Reports
  🏷️  Call 3/4: Extracting metadata...
     ✓ Found 5 tags, 8 keywords
  🎯 Call 4/4: Generating organization recommendations...
     ✓ Suggested: Documents/Reports/Financial/Q4-2024-financial-report.pdf
     ✓ Confidence: 85%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
╔═══════════════════════════════════════════════════════════════
║ FILE ANALYSIS RESULTS
╠═══════════════════════════════════════════════════════════════
║
║ BASIC UNDERSTANDING:
║   Title: Q4 2024 Financial Report
║   Summary: Quarterly financial analysis for TechCorp Inc Q4 2024
║   Main Topic: Financial Performance
║   Content Type: financial report
║
║ CATEGORIZATION:
║   Category: Documents
║   Subcategories: Financial Reports, Reports
║   File Type: quarterly report
║
║ METADATA:
║   Tags: financial, techcorp, q4-2024, revenue, profit
║   Date: 2024-12-15
║   People: Sarah Johnson, Michael Chen
║   Organizations: TechCorp Inc, Microsoft, Amazon
║   Keywords: revenue, operating-expenses, net-profit, saas, consulting
║
║ ORGANIZATION:
║   Path: Documents/Reports/Financial
║   Filename: Q4-2024-financial-report.pdf
║   Priority: high
║   Confidence: 85%
║
╚═══════════════════════════════════════════════════════════════
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Deep analysis complete!
ℹ️  This used 4 LLM calls for comprehensive understanding.
```

## Programmatic Usage

```typescript
import { analyzeFileMultiCall, formatAnalysisResult } from './multi-call-analyzer.js';
import { getConfig } from './utils.js';

// Get configuration
const config = await getConfig();

// Read file content
const fileContent = await fs.readFile('document.pdf', 'utf-8');
const fileName = 'document.pdf';
const mimeType = 'application/pdf';

// Perform multi-call analysis
const result = await analyzeFileMultiCall(config, fileName, fileContent, mimeType);

// Display formatted results
console.log(formatAnalysisResult(result));

// Or use individual fields
console.log(`Title: ${result.title}`);
console.log(`Category: ${result.category}`);
console.log(`Tags: ${result.tags.join(', ')}`);
console.log(`Suggested Path: ${result.suggestedPath}`);
console.log(`Confidence: ${result.confidence * 100}%`);
```

## Benefits

### 1. **Higher Accuracy**
Each call focuses on one aspect, allowing the LLM to provide more accurate analysis.

### 2. **Better Categorization**
The second call can make informed decisions based on the high-level understanding from the first call.

### 3. **Complete Metadata**
The third call specifically focuses on extracting all possible metadata without being distracted by other tasks.

### 4. **Informed Decisions**
The final call sees the complete picture and can make the best organization recommendation.

### 5. **Transparency**
You can see exactly what the AI understood at each step of the analysis.

## When to Use

### Use Multi-Call Analysis When:
- File content is complex or nuanced
- You need high accuracy in categorization
- Extracting detailed metadata is important
- Building a comprehensive file archive
- Initial organization is critical (won't reorganize later)

### Use Single-Call Analysis When:
- Processing many files quickly
- Content is straightforward
- Speed is more important than depth
- LLM costs are a concern
- Files are similar and repetitive

## Cost Considerations

Multi-call analysis makes **4 LLM calls** instead of 1:

- **4x the API calls** (if using paid APIs like OpenAI, Grok, DeepSeek)
- **~4x slower** (sequential calls)
- **Much higher accuracy** and detail

For local models (Ollama, LM Studio), there's no cost difference, just time.

### Cost Optimization:
1. Use local models for testing and development
2. Use multi-call for important files only
3. Use single-call for bulk processing
4. Cache analysis results to avoid re-analyzing

## Future Enhancements

Planned improvements:

- [ ] **Parallel calls** - Run calls 1 & 2 in parallel for speed
- [ ] **Configurable calls** - Choose which calls to make
- [ ] **Call history** - Save and review individual call results
- [ ] **Adaptive analysis** - Skip calls based on file type
- [ ] **Hybrid mode** - Auto-choose between single/multi based on complexity

## Comparison: Single vs Multi-Call

| Aspect | Single Call | Multi-Call |
|--------|-------------|------------|
| **Speed** | Fast (1 call) | Slower (4 calls) |
| **Accuracy** | Good | Excellent |
| **Detail** | Basic | Comprehensive |
| **Metadata** | Limited | Extensive |
| **Cost** | Low | 4x higher |
| **Use Case** | Bulk processing | Important files |
| **Transparency** | Black box | Step-by-step |

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    File to Analyze                          │
│                   (name, content, MIME)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Call 1: Basic Content Understanding                        │
│  Input:  File name, content, MIME type                      │
│  Output: title, summary, mainTopic, contentType             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Call 2: Detailed Categorization                            │
│  Input:  File name, MIME + Call 1 results                   │
│  Output: category, subcategories[], fileType                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Call 3: Metadata Extraction                                │
│  Input:  Content + Call 1 & 2 results                       │
│  Output: tags[], date, people[], locations[],               │
│          organizations[], keywords[]                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Call 4: Organization Recommendation                        │
│  Input:  All previous results                               │
│  Output: suggestedPath, suggestedFilename,                  │
│          priority, confidence                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Complete Analysis Result                       │
│        (all fields combined from 4 calls)                   │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

The multi-call analyzer is implemented in `src/multi-call-analyzer.ts`:

- **`analyzeFileMultiCall()`** - Main function coordinating all calls
- **`analyzeBasicContent()`** - Call 1 implementation
- **`analyzeCategorization()`** - Call 2 implementation
- **`analyzeMetadata()`** - Call 3 implementation
- **`analyzeOrganization()`** - Call 4 implementation
- **`formatAnalysisResult()`** - Pretty-print results

Each function:
1. Builds a focused prompt for that specific aspect
2. Calls `generatePromptResponse()` with the prompt
3. Parses and validates the JSON response
4. Returns structured data for the next call

## Examples

### Example 1: Research Paper

```bash
aifiles analyze-deep machine-learning-paper.pdf
```

Results:
- **Title:** Deep Learning Approaches for Natural Language Processing
- **Category:** Documents → Research Papers → Computer Science
- **Tags:** machine learning, nlp, deep learning, neural networks, transformers
- **Keywords:** bert, gpt, attention mechanism, training data, language models
- **Suggested Path:** Documents/Research/Computer-Science/AI-ML

### Example 2: Photo

```bash
aifiles analyze-deep vacation-photo.jpg
```

Results:
- **Title:** Beach Sunset in Santorini
- **Category:** Images → Photos → Travel
- **Date:** 2024-07-15
- **Location:** Santorini, Greece
- **Tags:** vacation, sunset, beach, travel, mediterranean
- **Suggested Path:** Images/Photos/2024/Travel/Greece

### Example 3: Code File

```bash
aifiles analyze-deep authentication-service.ts
```

Results:
- **Title:** User Authentication Service Implementation
- **Category:** Code → TypeScript → Services
- **Tags:** authentication, security, jwt, user-management, api
- **Keywords:** login, token, password, validation, middleware
- **Suggested Path:** Code/TypeScript/Backend/Services

## Troubleshooting

### Analysis Fails on Call 2/3/4

If analysis fails partway through, the LLM might not be returning valid JSON.

**Solution:**
1. Check your LLM configuration (`aifiles-setup`)
2. Try a different model (some models are better at JSON)
3. Check logs for the specific error
4. Increase timeout if using slow models

### Low Confidence Scores

If confidence scores are consistently low (<70%):

**Solution:**
1. File content might be too short or unclear
2. Try providing more context in the file
3. Check if the file type is supported
4. Consider using a more capable model

### Wrong Categorization

If the categorization doesn't match expectations:

**Solution:**
1. The file content might be ambiguous
2. Add more descriptive content to the file
3. Use custom prompts to guide categorization
4. Review Call 1 & 2 results to see where it diverged

## Contributing

To improve the multi-call analysis system:

1. Review the prompts in `src/multi-call-analyzer.ts`
2. Test with various file types
3. Suggest improvements via GitHub issues
4. Submit PRs with enhanced prompts or additional calls

## Related Documentation

- [Main README](../README.md)
- [API Documentation](../API.md)
- [Provider Configuration](../CONTRIBUTING.md)
- [Testing Guide](../TESTING.md)

---

**Generated with AIFiles Multi-Call Analysis System**
