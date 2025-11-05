import { cli } from 'cleye';
import { confirm, select, text } from '@clack/prompts';
import { green, lightCyan, red, yellow } from 'kolorist';
import { FolderTemplateManager, FolderTemplate } from './folder-templates.js';

// Check if running in non-interactive mode
const isNonInteractive = process.env.AIFILES_NON_INTERACTIVE === 'true' ||
                        process.argv.includes('--non-interactive') ||
                        !process.stdout.isTTY;

const argv = cli({
  name: 'aifiles-templates',
  version: '2.0.0',
  parameters: ['[command]', '[template-id]'],
  flags: {
    interactive: {
      type: Boolean,
      alias: 'i',
      description: 'Run in interactive mode',
    },
    help: {
      type: Boolean,
      alias: 'h',
      description: 'Show help information',
    },
  },
  help: {
    description: 'Manage folder templates for AIFiles',
  },
});

const templateManager = new FolderTemplateManager();

async function listTemplates() {
  console.log(lightCyan('\n📁 Folder Templates\n'));

  const templates = await templateManager.loadTemplates();

  if (templates.length === 0) {
    console.log(yellow('No templates configured yet.'));
    console.log('Run', green('aifiles-templates add'), 'to create your first template.');
    console.log('Or run', green('aifiles-templates menu'), 'for interactive mode.\n');
    return;
  }

  console.log(`Found ${templates.length} template${templates.length === 1 ? '' : 's'}:\n`);

  templates.forEach((template, index) => {
    const statusIcon = template.watchForChanges ? green('🟢') : yellow('🟡');
    const autoIcon = template.autoOrganize ? green('🤖') : '   ';

    console.log(`${statusIcon}${autoIcon} ${green(`${index + 1}.`)} ${lightCyan(template.name)}`);
    console.log(`      ${template.description}`);
    console.log(`      📂 Path: ${template.basePath}`);
    console.log(`      🏷️  Naming: ${template.namingStructure}`);
    console.log(`      🔤 Case: ${template.fileNameCase || 'snake'}`);
    console.log(`      🆔 ID: ${template.id}`);
    console.log('');
  });
}

async function addTemplate() {
  console.log(lightCyan('\n➕ Add New Template\n'));

  const name = await text({
    message: 'Template name:',
    placeholder: 'e.g., Work Documents',
    validate: (value) => {
      if (!value) return 'Name is required';
    },
  }) as string;

  const description = await text({
    message: 'Description:',
    placeholder: 'What is this template for?',
    validate: (value) => {
      if (!value) return 'Description is required';
    },
  }) as string;

  const basePath = await text({
    message: 'Base path:',
    placeholder: '~/Documents/Work',
    validate: (value) => {
      if (!value) return 'Base path is required';
    },
  }) as string;

  const namingStructure = await text({
    message: 'Naming structure:',
    placeholder: '{file_category_1}/{file_title}',
    validate: (value) => {
      if (!value) return 'Naming structure is required';
    },
  }) as string;

  const fileNameCase = await select({
    message: 'File name case:',
    options: [
      { value: 'snake', label: 'snake_case' },
      { value: 'kebab', label: 'kebab-case' },
      { value: 'camel', label: 'camelCase' },
      { value: 'pascal', label: 'PascalCase' },
      { value: 'upper_snake', label: 'UPPER_SNAKE' },
      { value: 'lower_snake', label: 'lower_snake' },
    ],
  }) as string;

  const autoOrganize = await confirm({
    message: 'Auto-organize files?',
    initialValue: false,
  }) as boolean;

  const watchForChanges = await confirm({
    message: 'Watch for changes?',
    initialValue: true,
  }) as boolean;

  const template: FolderTemplate = {
    id: Date.now().toString(),
    name,
    description,
    basePath,
    namingStructure,
    fileNameCase: fileNameCase as any,
    autoOrganize,
    watchForChanges,
  };

  await templateManager.addTemplate(template);
  console.log(green('\n✓ Template added successfully!\n'));
}

async function editTemplate(templateId: string) {
  console.log(lightCyan('\n✏️  Edit Template\n'));

  const templates = await templateManager.loadTemplates();
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    console.log(red(`\n✗ Template '${templateId}' not found\n`));
    return;
  }

  console.log(`Editing: ${lightCyan(template.name)}\n`);

  const name = await text({
    message: 'Template name:',
    placeholder: template.name,
    initialValue: template.name,
    validate: (value) => {
      if (!value) return 'Name is required';
    },
  }) as string;

  const description = await text({
    message: 'Description:',
    placeholder: template.description,
    initialValue: template.description,
    validate: (value) => {
      if (!value) return 'Description is required';
    },
  }) as string;

  const basePath = await text({
    message: 'Base path:',
    placeholder: template.basePath,
    initialValue: template.basePath,
    validate: (value) => {
      if (!value) return 'Base path is required';
    },
  }) as string;

  const namingStructure = await text({
    message: 'Naming structure:',
    placeholder: template.namingStructure,
    initialValue: template.namingStructure,
    validate: (value) => {
      if (!value) return 'Naming structure is required';
    },
  }) as string;

  const fileNameCase = await select({
    message: 'File name case:',
    initialValue: template.fileNameCase || 'snake',
    options: [
      { value: 'snake', label: 'snake_case' },
      { value: 'kebab', label: 'kebab-case' },
      { value: 'camel', label: 'camelCase' },
      { value: 'pascal', label: 'PascalCase' },
      { value: 'upper_snake', label: 'UPPER_SNAKE' },
      { value: 'lower_snake', label: 'lower_snake' },
    ],
  }) as string;

  const autoOrganize = await confirm({
    message: 'Auto-organize files?',
    initialValue: template.autoOrganize,
  }) as boolean;

  const watchForChanges = await confirm({
    message: 'Watch for changes?',
    initialValue: template.watchForChanges,
  }) as boolean;

  const updatedTemplate: FolderTemplate = {
    ...template,
    name,
    description,
    basePath,
    namingStructure,
    fileNameCase: fileNameCase as any,
    autoOrganize,
    watchForChanges,
  };

  await templateManager.updateTemplate(templateId, updatedTemplate);
  console.log(green('\n✓ Template updated successfully!\n'));
}

async function removeTemplate(templateId: string) {
  const templates = await templateManager.loadTemplates();
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    console.log(red(`\n✗ Template '${templateId}' not found\n`));
    return;
  }

  const confirmed = await confirm({
    message: `Remove template '${template.name}'?`,
    initialValue: false,
  });

  if (confirmed) {
    await templateManager.deleteTemplate(templateId);
    console.log(green(`\n✓ Template '${template.name}' removed\n`));
  } else {
    console.log(yellow('\nCancelled\n'));
  }
}

async function enableTemplate(templateId: string) {
  const templates = await templateManager.loadTemplates();
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    console.log(red(`\n✗ Template '${templateId}' not found\n`));
    return;
  }

  await templateManager.updateTemplate(templateId, { watchForChanges: true });
  console.log(green(`\n✓ Watching enabled for '${template.name}'\n`));
  console.log('Template will monitor for file changes when the file watcher is active.\n');
}

async function disableTemplate(templateId: string) {
  const templates = await templateManager.loadTemplates();
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    console.log(red(`\n✗ Template '${templateId}' not found\n`));
    return;
  }

  await templateManager.updateTemplate(templateId, { watchForChanges: false });
  console.log(yellow(`\n✓ Watching disabled for '${template.name}'\n`));
}

async function showInteractiveMenu() {
  console.log(lightCyan('\n🎛️  AIFiles Template Manager\n'));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const templates = await templateManager.loadTemplates();

    const options = [
      { value: 'list', label: '📋 List all templates' },
      { value: 'add', label: '➕ Add new template' },
      ...(templates.length > 0 ? [
        { value: 'edit', label: '✏️  Edit template' },
        { value: 'enable', label: '🟢 Enable watching' },
        { value: 'disable', label: '🟡 Disable watching' },
        { value: 'remove', label: '🗑️  Remove template' },
      ] : []),
      { value: 'exit', label: '🚪 Exit' },
    ];

    const action = await select({
      message: 'What would you like to do?',
      options,
    }) as string;

    if (action === 'exit') {
      console.log(green('\n👋 Goodbye!\n'));
      break;
    }

    try {
      switch (action) {
        case 'list':
          await listTemplates();
          break;
        case 'add':
          await addTemplate();
          break;
        case 'edit': {
          if (templates.length === 0) {
            console.log(yellow('No templates to edit.\n'));
            break;
          }
          const editOptions = templates.map((t, i) => ({
            value: t.id,
            label: `${i + 1}. ${t.name}`,
          }));
          const editId = await select({
            message: 'Select template to edit:',
            options: editOptions,
          }) as string;
          await editTemplate(editId);
          break;
        }
        case 'enable': {
          if (templates.length === 0) {
            console.log(yellow('No templates to enable.\n'));
            break;
          }
          const enableOptions = templates.map((t, i) => ({
            value: t.id,
            label: `${i + 1}. ${t.name}`,
          }));
          const enableId = await select({
            message: 'Select template to enable watching:',
            options: enableOptions,
          }) as string;
          await enableTemplate(enableId);
          break;
        }
        case 'disable': {
          if (templates.length === 0) {
            console.log(yellow('No templates to disable.\n'));
            break;
          }
          const disableOptions = templates.map((t, i) => ({
            value: t.id,
            label: `${i + 1}. ${t.name}`,
          }));
          const disableId = await select({
            message: 'Select template to disable watching:',
            options: disableOptions,
          }) as string;
          await disableTemplate(disableId);
          break;
        }
        case 'remove': {
          if (templates.length === 0) {
            console.log(yellow('No templates to remove.\n'));
            break;
          }
          const removeOptions = templates.map((t, i) => ({
            value: t.id,
            label: `${i + 1}. ${t.name}`,
          }));
          const removeId = await select({
            message: 'Select template to remove:',
            options: removeOptions,
          }) as string;
          await removeTemplate(removeId);
          break;
        }
      }
    } catch (error) {
      console.error(red(`\n✗ Error: ${error}\n`));
    }

    // Pause before showing menu again
    if (action !== 'exit') {
      await confirm({
        message: 'Press Enter to continue...',
        initialValue: true,
      });
    }
  }
}

// Execute command
(async () => {
  try {
    // Handle help flag
    if (argv.flags.help) {
      console.log(`
${lightCyan("🎛️  AIFiles Template Manager")} - Manage folder templates

${argv.help?.description}

${green("USAGE")}
  aifiles-templates [command] [template-id] [options]

${green("COMMANDS")}
  list                    List all folder templates
  add                     Add a new folder template (interactive)
  edit <template-id>      Edit an existing folder template
  remove <template-id>    Remove a folder template
  enable <template-id>    Enable watching for a template
  disable <template-id>   Disable watching for a template
  menu                    Interactive menu for all operations

${green("OPTIONS")}
  -i, --interactive       Run in interactive mode (same as 'menu')
  -h, --help              Show this help message

${green("EXAMPLES")}
  aifiles-templates list
  aifiles-templates add
  aifiles-templates edit abc123
  aifiles-templates menu
`);
      process.exit(0);
    }

    const command = argv._.command as string;
    const templateId = argv._.templateId as string;

    // Check if interactive mode is requested
    if (argv.flags.interactive || command === 'menu') {
      if (isNonInteractive) {
        console.log(yellow('⚠️  Interactive mode not available in non-interactive environment'));
        console.log('Use specific commands: list, add, edit, remove, enable, disable');
        process.exit(1);
      }
      await showInteractiveMenu();
    } else if (command === 'list' || !command) {
      await listTemplates();
    } else if (command === 'add') {
      if (isNonInteractive) {
        console.log(red('✗ Add command requires interactive mode'));
        console.log('Use: aifiles-templates --interactive add');
        process.exit(1);
      }
      await addTemplate();
    } else if (command === 'edit') {
      if (!templateId) {
        console.log(red('\n✗ Template ID required for edit command\n'));
        console.log('Usage:', green('aifiles-templates edit <template-id>'));
        process.exit(1);
      }
      if (isNonInteractive) {
        console.log(red('✗ Edit command requires interactive mode'));
        console.log('Use: aifiles-templates --interactive edit');
        process.exit(1);
      }
      await editTemplate(templateId);
    } else if (command === 'remove') {
      if (!templateId) {
        console.log(red('\n✗ Template ID required for remove command\n'));
        console.log('Usage:', green('aifiles-templates remove <template-id>'));
        process.exit(1);
      }
      if (isNonInteractive) {
        const confirmed = process.env.AIFILES_CONFIRM_DELETE === 'true';
        if (!confirmed) {
          console.log(red('✗ Remove command requires confirmation in non-interactive mode'));
          console.log('Set AIFILES_CONFIRM_DELETE=true to confirm');
          process.exit(1);
        }
      } else {
        const confirmed = await confirm({
          message: `Remove template "${templateId}"?`,
          initialValue: false,
        });
        if (!confirmed) {
          console.log(yellow('Operation cancelled.'));
          return;
        }
      }
      await removeTemplate(templateId);
    } else if (command === 'enable') {
      if (!templateId) {
        console.log(red('\n✗ Template ID required for enable command\n'));
        console.log('Usage:', green('aifiles-templates enable <template-id>'));
        process.exit(1);
      }
      await enableTemplate(templateId);
    } else if (command === 'disable') {
      if (!templateId) {
        console.log(red('\n✗ Template ID required for disable command\n'));
        console.log('Usage:', green('aifiles-templates disable <template-id>'));
        process.exit(1);
      }
      await disableTemplate(templateId);
    } else {
      console.log(red(`\n✗ Unknown command: ${command}\n`));
      console.log('Run', green('aifiles-templates --help'), 'for available commands.');
      process.exit(1);
    }
  } catch (error) {
    console.error(red(`\n✗ Error: ${error}\n`));
    process.exit(1);
  }
})();
