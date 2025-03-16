<div align="center">
  <div>
    <img src=".github/screencapture.gif" alt="AI Files"/>
    <h1 align="center">🤖 AI Files</h1>
  </div>
	<p>A CLI that helps you organize and manage your files using AI.</p>
	<a href="https://www.npmjs.com/package/aifiles"><img
src="https://img.shields.io/npm/v/aifiles" alt="Current version"></a>
</div>

⚠️ This app uses ChatGPT 🤖, which could raise privacy concerns. Please be cautious when sharing personal information.🔒

# Installation

To install AI Files, simply run:

```
npm install aifiles
```

You will also need to install the following dependencies:
- [https://pandoc.org/](pandoc)
- [https://exiftool.org/](exiftool)
- [https://poppler.freedesktop.org/](pdftotext) (included via poppler)
- [https://csvkit.readthedocs.io/en/latest/](in2csv) (included via csvkit)

Copy-and-paste version:
```
brew install pandoc exiftool poppler csvkit
```

# Usage

To use AI Files, copy the `.aifiles` and `.aifiles.json` files to your home directory.

```
mkdir git
cd ~/git
git clone https://github.com/jjuliano/aifiles.git
cp aifiles/.aifiles.sample ~/.aifiles
cp aifiles/.aifiles.json ~/.aifiles.json
```

You would need to modify the ~/.aifiles and add your `OPENAI_API_KEY` and `REPLICATE_API_KEY` (for audio/video captioning).

Then, run:

```
aifiles [filename]
```

where filename is the name of the file you want to process.

# Features

## AI Files can:

- Organize audio, video, pictures, documents, archives, and other types of files
- Automatically extract relevant information from your files using OpenAI ChatGPT.
- Automatically add tag and comments to the file
- Organize your files into categories and directories based on their content
- Rename your files using a [customizable naming convention](https://github.com/jjuliano/aifiles/blob/main/.aifiles.sample#L28)
- Store your files in a designated directory

# File Organization

AI Files can help you implement sophisticated file organization structures. Below is an expanded hierarchical file structure for legal case management with advanced forensic capabilities, metadata management, and chain of custody tracking:

```
LEGAL_CASE_MANAGEMENT/
│
├── 01_ACTIVE_CASES/
│   ├── CASE_2023-001_SMITH_v_JONES/
│   │   ├── 01_Case_Administration/
│   │   │   ├── Case_Summary.md
│   │   │   ├── Contact_Information/
│   │   │   ├── Billing_Records/
│   │   │   └── Case_Timeline.xlsx
│   │   │
│   │   ├── 02_Pleadings/
│   │   │   ├── Complaint/
│   │   │   ├── Answer/
│   │   │   ├── Motions/
│   │   │   │   ├── Filed/
│   │   │   │   └── Drafts/
│   │   │   └── Orders/
│   │   │
│   │   ├── 03_Discovery/
│   │   │   ├── Requests/
│   │   │   ├── Responses/
│   │   │   ├── Depositions/
│   │   │   └── Evidence_Log.xlsx
│   │   │
│   │   ├── 04_Evidence_Repository/
│   │   │   ├── Physical_Evidence/  # References to physical items
│   │   │   │   └── Tracking_Logs/
│   │   │   │
│   │   │   ├── Digital_Evidence/
│   │   │   │   ├── Original_Media/  # Write-protected original files
│   │   │   │   │   └── [HASH_VERIFIED]/
│   │   │   │   │
│   │   │   │   ├── Working_Copies/
│   │   │   │   └── Extracted_Data/
│   │   │   │
│   │   │   ├── Documentary_Evidence/
│   │   │   │   ├── Contracts/
│   │   │   │   ├── Correspondence/
│   │   │   │   ├── Financial_Records/
│   │   │   │   └── Medical_Records/
│   │   │   │
│   │   │   └── Multimedia/
│   │   │       ├── Images/
│   │   │       ├── Audio/
│   │   │       ├── Video/
│   │   │       └── Transcripts/
│   │   │
│   │   └── 05_Work_Product/
│   │       ├── Research/
│   │       ├── Drafts/
│   │       ├── Analysis/
│   │       └── Trial_Preparation/
│   │
│   └── CASE_2023-002_DOE_ESTATE/
│       └── [Similar structure as above]
│
├── 02_FORENSIC_OPERATIONS/
│   ├── 01_Chain_of_Custody/
│   │   ├── Custody_Records/
│   │   │   └── [Case_ID]/
│   │   │       ├── Transfer_Logs/
│   │   │       ├── Access_Logs/
│   │   │       └── Disposition_Records/
│   │   │
│   │   ├── Custody_Forms/
│   │   │   ├── Templates/
│   │   │   └── Completed/
│   │   │
│   │   └── Custody_Verification/
│   │       ├── Signatures/
│   │       └── Authentication_Records/
│   │
│   ├── 02_Digital_Forensics/
│   │   ├── Disk_Images/
│   │   │   ├── Raw_Images/
│   │   │   └── Verification_Hashes/
│   │   │
│   │   ├── Mobile_Forensics/
│   │   │   ├── Extractions/
│   │   │   └── Reports/
│   │   │
│   │   ├── Network_Forensics/
│   │   │   ├── Traffic_Captures/
│   │   │   └── Analysis/
│   │   │
│   │   ├── Memory_Forensics/
│   │   │   ├── Memory_Dumps/
│   │   │   └── Analysis_Reports/
│   │   │
│   │   └── Forensic_Workstations/
│   │       ├── Tools_Configuration/
│   │       └── Validation_Reports/
│   │
│   ├── 03_Metadata_Management/
│   │   ├── Extraction_Profiles/
│   │   │   ├── Document_Metadata/
│   │   │   ├── Image_EXIF_Data/
│   │   │   ├── Email_Headers/
│   │   │   └── File_System_Metadata/
│   │   │
│   │   ├── Metadata_Repository/
│   │   │   └── [Case_ID]/
│   │   │       ├── Raw_Metadata/
│   │   │       └── Processed_Metadata/
│   │   │
│   │   └── Analysis_Tools/
│   │       ├── Timeline_Generation/
│   │       ├── Relationship_Mapping/
│   │       └── Anomaly_Detection/
│   │
│   └── 04_Cryptographic_Verification/
│       ├── Hash_Database/
│       │   ├── MD5_Hashes/
│       │   ├── SHA1_Hashes/
│       │   ├── SHA256_Hashes/
│       │   └── Hash_Sets/
│       │
│       ├── Digital_Signatures/
│       │   ├── Signature_Keys/
│       │   └── Verification_Logs/
│       │
│       ├── Blockchain_Verification/
│       │   ├── Transaction_Records/
│       │   └── Proof_of_Existence/
│       │
│       └── Temporal_Validation/
│           ├── Timestamp_Records/
│           └── Chronology_Verification/
│
├── 03_AUTOMATION_CENTER/
│   ├── 01_Document_Processing/
│   │   ├── Intake_Workflows/
│   │   │   ├── Document_Scanning/
│   │   │   ├── Email_Ingestion/
│   │   │   └── Upload_Processing/
│   │   │
│   │   ├── OCR_Processing/
│   │   │   ├── Text_Extraction/
│   │   │   ├── Layout_Analysis/
│   │   │   └── Quality_Control/
│   │   │
│   │   ├── Classification_Engine/
│   │   │   ├── Document_Types/
│   │   │   ├── Training_Sets/
│   │   │   └── Classification_Rules/
│   │   │
│   │   └── Enrichment_Pipelines/
│   │       ├── Entity_Extraction/
│   │       ├── Sentiment_Analysis/
│   │       └── Topic_Modeling/
│   │
│   ├── 02_Intelligence_Automation/
│   │   ├── Research_Assistants/
│   │   │   ├── Case_Law_Research/
│   │   │   ├── Statutory_Analysis/
│   │   │   └── Legal_Precedent_Matching/
│   │   │
│   │   ├── Predictive_Analytics/
│   │   │   ├── Case_Outcome_Models/
│   │   │   ├── Settlement_Calculators/
│   │   │   └── Risk_Assessment_Tools/
│   │   │
│   │   ├── Drafting_Assistants/
│   │   │   ├── Template_Library/
│   │   │   ├── Clause_Database/
│   │   │   └── Document_Assembly/
│   │   │
│   │   └── Expert_Systems/
│   │       ├── Decision_Trees/
│   │       ├── Rules_Engines/
│   │       └── Knowledge_Bases/
│   │
│   ├── 03_Process_Automation/
│   │   ├── Workflow_Orchestration/
│   │   │   ├── Workflow_Definitions/
│   │   │   ├── Trigger_Events/
│   │   │   └── Execution_Logs/
│   │   │
│   │   ├── Task_Management/
│   │   │   ├── Task_Queues/
│   │   │   ├── Assignment_Rules/
│   │   │   └── Progress_Tracking/
│   │   │
│   │   ├── Notification_System/
│   │   │   ├── Alert_Rules/
│   │   │   ├── Message_Templates/
│   │   │   └── Delivery_Channels/
│   │   │
│   │   └── Calendar_Management/
│   │       ├── Court_Dates/
│   │       ├── Filing_Deadlines/
│   │       └── Internal_Milestones/
│   │
│   └── 04_Quality_Assurance/
│       ├── Validation_Rules/
│       ├── Compliance_Checks/
│       ├── Error_Handling/
│       └── Audit_Trails/
│
└── 04_KNOWLEDGE_MANAGEMENT/
    ├── 01_Document_Repository/
    │   ├── Templates/
    │   ├── Precedents/
    │   ├── Research_Memoranda/
    │   └── Best_Practices/
    │
    ├── 02_Expertise_Database/
    │   ├── Subject_Matter_Experts/
    │   ├── External_Consultants/
    │   └── Knowledge_Maps/
    │
    ├── 03_Learning_Systems/
    │   ├── Training_Materials/
    │   ├── Continuing_Education/
    │   └── Knowledge_Transfer/
    │
    └── 04_Analytics_Platform/
        ├── Business_Intelligence/
        ├── Performance_Metrics/
        ├── Trend_Analysis/
        └── Reporting_Dashboards/
```

## Advanced Forensic & Metadata Capabilities

AI Files provides sophisticated capabilities for maintaining evidence integrity and forensic-grade file management:

### 1. Cryptographic Integrity

- **Multi-algorithm Hashing**: Automatically generate MD5, SHA-1, SHA-256 hashes for all ingested files
- **Hash Verification**: Continuously validate file integrity through scheduled hash verification
- **Tamper Detection**: Immediate alerts upon detection of unauthorized file modifications
- **Digital Signatures**: Apply cryptographic signatures to establish authenticity of critical documents

### 2. Chain of Custody Management

- **Access Tracking**: Comprehensive logging of all file access, modifications, and transfers
- **Custody Documentation**: Automatically generate and maintain chain of custody documentation
- **Custodian Management**: Track all individuals who have handled or accessed evidence
- **Transfer Authentication**: Require multi-factor authentication for evidence transfers
- **Temporal Validation**: Cryptographically sealed timestamps to prevent backdating

### 3. Advanced Metadata Systems

- **Comprehensive Extraction**: Extract over 300 metadata fields from various file types
- **Custom Metadata Schemas**: Define case-specific metadata frameworks tailored to investigation needs
- **Hierarchical Tagging**: Multi-level tagging system with inheritance and relationship mapping
- **Provenance Tracking**: Record complete history of file origin and transformations
- **Metadata Search**: Advanced search capabilities across all metadata fields with Boolean operators

### 4. Forensic Integration

- **Forensic Image Support**: Work directly with forensic disk images in common formats (E01, AFF, RAW)
- **Write Blocking**: Enforce read-only access to preserve original evidence
- **Deleted File Recovery**: Integrate with file recovery tools to catalog and manage recovered files
- **Registry Analysis**: Extract and catalog Windows registry artifacts
- **Mobile Forensics**: Process and organize extractions from mobile device forensic tools

## Enhanced Automation Capabilities

AI Files enables sophisticated automation workflows within your file structure:

### 1. Intelligent Processing

- **Content-Aware Routing**: Automatically analyze and route documents based on content, context, and case requirements
- **Differential Processing**: Apply different workflows based on document sensitivity, type, and evidentiary value
- **Multi-stage Classification**: Cascade of AI classifiers for precise document categorization
- **Jurisdiction-Specific Processing**: Customize handling based on applicable legal jurisdictions
- **Privilege Detection**: Automatically flag potentially privileged communications for review

### 2. Evidence Enhancement

- **Auto-Transcription**: Convert audio/video evidence to searchable text with speaker identification
- **Image Enhancement**: Apply forensic image clarification techniques to photographic evidence
- **Spatial Reconstruction**: Generate 3D models from 2D evidence photos for scene reconstruction
- **Entity Correlation**: Connect related entities across disparate evidence sources
- **Timeline Generation**: Automatically construct chronologies based on document metadata

### 3. Workflow Orchestration

- **Dynamic Pipelines**: Self-adapting workflows that change based on document characteristics
- **Parallel Processing**: Distribute high-volume document processing across multiple processing lanes
- **Human-in-the-Loop**: Strategic insertion of human review points in automated workflows
- **Conditional Logic**: Complex if-then-else routing based on content analysis and metadata
- **SLA Management**: Prioritize processing based on case deadlines and service level agreements

### 4. Integration Ecosystem

- **E-Discovery Platforms**: Bidirectional integration with major e-discovery platforms
- **Case Management Systems**: Synchronize with legal practice management software
- **Court Filing Systems**: Automated preparation of documents for electronic court filing
- **Expert Systems**: Connect with specialized tools for financial, medical, or technical analysis
- **Blockchain Validation**: Verify document existence and integrity through distributed ledger technology

## Best Practices to Maintain Your File Structure:

- **Consistent Naming**: Use a consistent naming scheme, e.g., `YYYY-MM-DD_Type_Description` for automated sorting and retrieval.
- **Regular Updates**: Configure AI Files to automatically scan and update folders daily to ensure all documents are properly filed.
- **Intelligent Tagging**: Set up automatic document tagging based on content analysis for faster searching and cross-referencing.
- **Backup Automation**: Schedule automatic backups of your hierarchical structure to secure storage with versioning.
- **Smart Archiving**: Use AI to identify and archive resolved or older matters based on case status and activity dates.
- **Workflow Integration**: Connect your file structure with task management systems to automate follow-ups and deadlines.
- **Metadata Enhancement**: Automatically extract and standardize document metadata for improved searchability.
- **OCR Processing**: Configure automatic OCR for all scanned documents to make content searchable and analyzable.

AI Files can be configured to implement these practices automatically, transforming your static file system into an intelligent document management system that evolves with your needs.

# Advanced Installation & Setup

For users who need a comprehensive setup process, follow these detailed instructions to ensure a proper installation and initialization of AI Files.

## System Requirements & Prerequisites

Before installing AI Files, ensure your system meets the following requirements:

- **Operating System**: Windows, macOS, or Linux
- **Essential Tools**:
  - **Node.js** (v14+) and **npm** (v6+) - Verify with `node --version` and `npm --version`
  - **Git** - Verify with `git --version`
  - **Command-line tools**:
    - pandoc - Verify with `pandoc --version`
    - exiftool - Verify with `exiftool -ver`
    - poppler utilities - Verify with `pdftotext -v`
    - csvkit - Verify with `in2csv --version`

## Step-by-Step Installation

### 1. Clone the Repository

```bash
# Navigate to your preferred directory
mkdir -p ~/git
cd ~/git

# Clone the AI Files repository
git clone https://github.com/jjuliano/aifiles.git

# Navigate into the cloned directory
cd aifiles
```

### 2. Install Node Package

Choose one of the following installation methods:

#### Global Installation (Recommended)

```bash
# Install globally to use aifiles from any directory
npm install -g aifiles
```

#### Local Installation

```bash
# Install locally in the current project
npm install aifiles
```

### 3. Install Dependencies

#### macOS

```bash
# Using Homebrew
brew install pandoc exiftool poppler csvkit
```

#### Linux (Ubuntu/Debian)

```bash
# Using apt
sudo apt-get update
sudo apt-get install pandoc libimage-exiftool-perl poppler-utils python3-csvkit
```

#### Windows

```bash
# Using Chocolatey
choco install pandoc exiftool poppler csvkit
```

### 4. Configure AI Files

```bash
# Copy configuration files to your home directory
cp .aifiles.sample ~/.aifiles
cp .aifiles.json ~/.aifiles.json

# Edit the configuration file to add your API keys
nano ~/.aifiles  # or use your preferred text editor
```

Add your API keys to the configuration file:

```
# AI Files Configuration
OPENAI_API_KEY=your_openai_api_key_here
REPLICATE_API_KEY=your_replicate_api_key_here  # For audio/video captioning
```

### 4.1 API Key Security Best Practices

When working with API keys for AI Files:

- **Never share your API keys** in public repositories, chats, or forums
- **Use environment variables** when possible instead of hardcoding keys
- **Set up key rotation** schedules to regularly update your keys
- **Apply access restrictions** to your API keys (IP limitations, usage caps)
- **Monitor usage** to detect unauthorized access or unusual patterns
- **Create dedicated keys** for different applications/environments
- **Revoke compromised keys** immediately if you suspect they've been exposed

For advanced users, consider using a secrets manager like:
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager

```bash
# Example of using environment variables instead of editing ~/.aifiles
echo 'export OPENAI_API_KEY="your_key_here"' >> ~/.bashrc
echo 'export REPLICATE_API_KEY="your_key_here"' >> ~/.bashrc
source ~/.bashrc
```

### 5. Verify Installation

```bash
# Test the installation with a simple file
aifiles test_document.txt
```

You should see AI Files processing the document and organizing it according to your configuration.

### 6. Troubleshooting

If you encounter issues:

1. **Check Dependencies**: Ensure all required tools are installed and accessible in your PATH
2. **API Key Issues**: Verify your API keys are correctly configured in `~/.aifiles`
3. **Permission Problems**: Ensure the target directories are writable
4. **Log Files**: Check for error logs in `~/.aifiles_log` (if enabled)

#### Windows-Specific Issues

When installing on Windows, you may encounter build errors related to `osx-tag`:

```
fatal error C1083: Cannot open type library file: 'Foundation/Foundation.h': No such file or directory
```

This occurs because the `osx-tag` dependency is specifically designed for macOS systems. To resolve this:

**Option 1: Skip Optional Dependencies**
```bash
npm install aifiles --no-optional
```

**Option 2: Use WSL (Windows Subsystem for Linux)**
```bash
# Install WSL if not already installed
wsl --install

# Then in your WSL environment:
npm install aifiles
```

**Option 3: Configure npm to ignore specific build errors**
```bash
# Create or edit .npmrc file in your home directory
echo "ignore-scripts=true" >> ~/.npmrc

# Then install
npm install aifiles

# Remember to remove this setting afterward if needed
```

Note: Some tagging features may be limited on Windows systems, but core functionality will still work.

For detailed assistance, open an issue on the [GitHub repository](https://github.com/jjuliano/aifiles/issues).

# TODO

- [See issue #9](https://github.com/jjuliano/aifiles/issues/9)

# Contributions

Contributions are welcome! Feel free to open issues and pull requests on GitHub.

# License

This project is licensed under the MIT License.
