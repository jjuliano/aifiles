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
- pandoc
- exiftool
- pdftotext (included in poppler)
- in2csv (included in csvkit)

Copy-and-paste version:
```
brew install pandoc exiftooll poppler in2csv
```

# Usage

To use AI Files, copy the `.aifiles` and `.aifiles.json` files to your home directory.

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
- Rename your files using a customizable naming convention
- Store your files in a designated directory

# TODO

- Native file info extraction (no external binary deps.)
- Local LLMs.
- Easy wizard configurator upon first run.
- Untested on Windows. (It uses `cat` to view text files.)
- Select themed folder structure and curation, i.e. warez style, etc.
- Abilty to pattern new folder categories with existing ones
- Seemless cross-platform support
- Landing page 2.0
- Fix exiftool usage
- Bug fixes

# Contributions

Contributions are welcome! Feel free to open issues and pull requests on GitHub.

# License

This project is licensed under the MIT License.

