import { green, lightCyan, red } from "kolorist";
import { intro, outro, select, spinner, text } from "@clack/prompts";
import { cli } from "cleye";
import { description, version } from "../package.json";
import {
  addCommentsToFile,
  addTagsToFile,
  askForContext,
  askForRevisionNumber,
  displayChanges,
  fileExists,
  generatePromptResponse,
  getConfig,
  getPrompt,
  replacePromptKeys,
  resolvePath,
  separateFolderAndFile,
  parseJson,
} from "./utils.js";
import Replicate from "replicate-js";
import fs from "fs/promises";

const argv = cli({
  name: "aifiles",

  version,
  parameters: ["<file>"],

  help: {
    description,
  },
});

const config = await getConfig();
const apiKey =
  process.env.OPENAI_KEY ??
  process.env.OPENAI_API_KEY ??
  process.env.OPENAI_API_TOKEN ??
  config.OPENAI_API_KEY;

const token =
  process.env.REPLICATE_KEY ??
  process.env.REPLICATE_API_KEY ??
  process.env.REPLICATE_API_TOKEN ??
  config.REPLICATE_API_KEY;

if (!apiKey) {
  throw new Error("Please set your OpenAI API key in ~/.aifiles");
}

if (!token) {
  throw new Error("Please set your Replicate API key in ~/.aifiles");
}

(async () => {
  intro(lightCyan(" aifiles "));

  let success = false;
  while (!success) {
    try {
      const target = argv._.file;

      const detectingFiles = spinner();
      detectingFiles.start(`Detecting file: ${target}`);
      fileExists(target).then((exists) => {
        if (!exists) {
          throw new Error(`File not found: ${target}`);
        }
      });

      const { prompt, format, mainDir, fileExt, fileCase } = await getPrompt(
        config,
        target,
        new Replicate({ token }),
        Number(config.MAX_CONTENT_WORDS)
      );
      detectingFiles.stop(`File ${target} ready for analysis!`);

      const s = spinner();
      s.start("The AI is analyzing your file");
      const message = await generatePromptResponse(apiKey, prompt);
      s.stop(`File analyzed!`);

      const promptObj = await parseJson(message);
      let newFile = await replacePromptKeys(
        format,
        promptObj,
        mainDir,
        fileExt,
        fileCase
      );

      let [folderName, fileName] = separateFolderAndFile(newFile);

      await displayChanges(
        "File changes",
        target,
        newFile,
        promptObj.internal_file_tags,
        promptObj.internal_file_summary,
        ""
      );

      if (config.PROMPT_FOR_REVISION_NUMBER) {
        const ver = await askForRevisionNumber();
        if (ver != null) {
          [folderName, fileName] = separateFolderAndFile(newFile);
          const newPathWithRevision = resolvePath(
            `${folderName}/${fileName}-v${ver}${fileExt}`
          );
          await displayChanges(
            "File Organized!",
            newFile,
            newPathWithRevision,
            promptObj.internal_file_tags,
            promptObj.internal_file_summary,
            `-v${ver}`
          );

          newFile = newPathWithRevision;
        }
      }

      if (config.PROMPT_FOR_CUSTOM_CONTEXT) {
        const context = await askForContext();
        if (context != null) {
          [folderName, fileName] = separateFolderAndFile(newFile);
          const newPathWithContext = resolvePath(
            `${folderName}/${context}-${fileName}${fileExt}`
          );
          await displayChanges(
            "File Organized!",
            newFile,
            newPathWithContext,
            promptObj.internal_file_tags,
            promptObj.internal_file_summary,
            context
          );

          newFile = newPathWithContext;
        }
      }

      await displayChanges(
        "File Organized!",
        target,
        newFile,
        promptObj.internal_file_tags,
        promptObj.internal_file_summary,
        ""
      );

      let confirmed: string | symbol = await select({
        message: `Organize your file?\n\n\n`,
        options: [
          {
            value: "yes",
            label: "Yes, organize it this way",
          },
          {
            value: "no",
            label: "No, edit the file organization changes",
          },
          {
            value: "cancel",
            label: "Cancel",
          },
        ],
      });

      while (confirmed !== "yes") {
        if (confirmed === "cancel") {
          process.exit(1); // Exit the script if tryAgain is false
        } else if (confirmed === "no") {
          const filename = await text({
            message: "Enter the new filename:",
            initialValue: newFile,
          });

          newFile = resolvePath(<string>filename);
          await displayChanges(
            "File changes",
            target,
            newFile,
            promptObj.internal_file_tags,
            promptObj.internal_file_summary,
            String(filename)
          );
        }

        confirmed = await select({
          message: `Organize your file?\n\n\n`,
          options: [
            {
              value: "yes",
              label: "Yes, organize it this way",
            },
            {
              value: "no",
              label: "No, edit the file organization changes",
            },
            {
              value: "cancel",
              label: "Cancel",
            },
          ],
        });
      }

      if (confirmed == "yes") {
        [folderName, fileName] = separateFolderAndFile(newFile);

        await fs.mkdir(resolvePath(folderName), { recursive: true });
        if (!config.MOVE_FILE_OPERATION) {
          await fs.copyFile(resolvePath(target), `${newFile}`);
        } else {
          await fs.rename(resolvePath(target), `${newFile}`);
        }

        await addTagsToFile(newFile, promptObj.internal_file_tags);
        await addCommentsToFile(newFile, promptObj.internal_file_summary);
      }

      success = true; // If there are no errors, set success to true and exit the while loop
    } catch (error) {
      outro(`${red("✖")} ${error}`);

      const tryAgain = await select({
        message: "An error occurred. Do you want to try again?",
        options: [
          { value: "yes", label: "Yes, try again." },
          { value: "no", label: "No, please exit." },
        ],
      });
      if (tryAgain != "yes") {
        process.exit(1); // Exit the script if tryAgain is false
      }
    }
  }

  outro(`${green("✔")} Successfully organized!`);
})();
