# Lockfile Mechanism

AIFiles uses lockfiles to prevent multiple instances from interfering with each other.

## How It Works

AIFiles uses **separate lockfiles** for different modes:

- **Normal Mode**: `.aifiles.lock` - Used when organizing files
- **Watch Mode**: `.aifiles-watch.lock` - Used when running `aifiles watch`
- **File Manager**: `.aifiles-filemanager.lock` - Used when running `aifiles filemanager`

This allows you to run **one instance of each mode simultaneously**:

✅ **Allowed**: Normal mode + Watch mode running together
✅ **Allowed**: Normal mode + File Manager running together
✅ **Allowed**: Watch mode + File Manager running together
❌ **Blocked**: Two normal mode instances
❌ **Blocked**: Two watch mode instances
❌ **Blocked**: Two file manager instances

## Lockfile Location

All lockfiles are stored in: `~/.aifiles/`

- `~/.aifiles/.aifiles.lock` - Normal mode
- `~/.aifiles/.aifiles-watch.lock` - Watch mode (daemon)
- `~/.aifiles/.aifiles-filemanager.lock` - File manager

## What Happens When a Lock Exists?

If you try to start a mode that's already running, you'll see:

```
❌ Another instance of AIFiles is already running!

  Process ID: 12345
  Command: aifiles organize
  Running for: 5 minutes

To stop the existing instance:
  1. Kill the process: kill 12345
  2. Remove the lock file: rm "/Users/username/.aifiles/.aifiles.lock"

Or use this command: kill 12345 && rm "/Users/username/.aifiles/.aifiles.lock"
```

## Stale Lockfiles

If a lockfile exists but the process is no longer running (crashed or killed), AIFiles will automatically:

1. Detect that the process is dead
2. Remove the stale lockfile
3. Continue normally

You'll see: `🧹 Removing stale lock file from previous instance...`

## Manual Cleanup

If you need to manually remove a lockfile:

```bash
# Remove normal mode lock
rm ~/.aifiles/.aifiles.lock

# Remove watch mode lock
rm ~/.aifiles/.aifiles-watch.lock

# Remove file manager lock
rm ~/.aifiles/.aifiles-filemanager.lock

# Remove all locks
rm ~/.aifiles/.aifiles*.lock
```

## Example Scenarios

### Scenario 1: Running Watch Mode and Normal Mode Together ✅

```bash
# Terminal 1: Start watch mode
aifiles watch
# ✅ Lock acquired: .aifiles-watch.lock

# Terminal 2: Organize a file
aifiles document.pdf
# ✅ Lock acquired: .aifiles.lock (different lockfile!)

# Both can run simultaneously
```

### Scenario 2: Two Normal Mode Instances ❌

```bash
# Terminal 1: Organize a file
aifiles document.pdf
# ✅ Lock acquired: .aifiles.lock

# Terminal 2: Try to organize another file
aifiles photo.jpg
# ❌ Error: Another instance of AIFiles is already running!
```

### Scenario 3: Two Watch Mode Instances ❌

```bash
# Terminal 1: Start watch mode
aifiles watch
# ✅ Lock acquired: .aifiles-watch.lock

# Terminal 2: Try to start another watch mode
aifiles watch
# ❌ Error: Another instance of Watch mode (daemon) is already running!
```

## Implementation Details

The lockfile contains:

```json
{
  "pid": 12345,
  "startTime": 1699999999999,
  "command": "aifiles watch"
}
```

- `pid`: Process ID of the running instance
- `startTime`: Timestamp when the instance started
- `command`: Command that was executed

## Cleanup on Exit

Lockfiles are automatically cleaned up when:

- ✅ Process exits normally
- ✅ Process receives SIGINT (Ctrl+C)
- ✅ Process receives SIGTERM
- ✅ Uncaught exception occurs
- ✅ Unhandled promise rejection occurs

## Troubleshooting

### "Lock file won't delete"

If you can't delete a lockfile, the process might still be running:

```bash
# Check if process is running
ps aux | grep aifiles

# Kill the process
kill <PID>

# Then remove lockfile
rm ~/.aifiles/.aifiles.lock
```

### "Stale lock keeps appearing"

If stale locks keep appearing, a process might be crashing. Check logs:

```bash
# Run with verbose output
aifiles --verbose document.pdf

# Check system logs
journalctl -u aifiles  # Linux
log show --predicate 'process == "node"' --last 1h  # macOS
```

### "I need to run multiple normal instances"

This is intentionally blocked to prevent file conflicts. Alternatives:

1. **Use batch mode**: `aifiles --batch file1.pdf file2.pdf file3.pdf`
2. **Run sequentially**: Wait for first instance to finish
3. **Use watch mode**: It handles multiple files automatically

## Technical Notes

- Lockfile check is performed **before** any file operations
- Process ID validation ensures stale locks are cleaned
- Different modes use different lockfiles to avoid blocking each other
- Cleanup handlers ensure lockfiles are removed on exit
- Signal handlers (SIGINT/SIGTERM) properly clean up locks
