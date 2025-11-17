# Lockfile Implementation Summary

## Overview

AIFiles now has a robust lockfile mechanism to prevent multiple instances from running simultaneously, while allowing different modes to coexist.

## Files Created/Modified

### New Files
1. **`src/lockfile.ts`** - Complete lockfile manager implementation
2. **`docs/LOCKFILE.md`** - User-facing documentation
3. **`test-separate-locks.sh`** - Demonstration script

### Modified Files
1. **`src/cli.ts`** - Integrated lockfile checking at startup

## How It Works

### Three Separate Lockfiles

```typescript
enum LockMode {
  NORMAL = 'normal',        // .aifiles.lock
  WATCH = 'watch',          // .aifiles-watch.lock
  FILEMANAGER = 'filemanager' // .aifiles-filemanager.lock
}
```

### Lock Combinations

| Mode 1 | Mode 2 | Allowed? |
|--------|--------|----------|
| Normal | Normal | ❌ Blocked |
| Watch | Watch | ❌ Blocked |
| File Manager | File Manager | ❌ Blocked |
| Normal | Watch | ✅ Allowed |
| Normal | File Manager | ✅ Allowed |
| Watch | File Manager | ✅ Allowed |

## Features

### ✅ Process Detection
- Checks if process is still running using `process.kill(pid, 0)`
- Automatically removes stale lockfiles
- Shows process uptime in error messages

### ✅ Graceful Cleanup
- Handles SIGINT (Ctrl+C)
- Handles SIGTERM
- Handles uncaught exceptions
- Handles unhandled promise rejections
- Cleanup on normal exit

### ✅ Informative Error Messages

When blocked:
```
❌ Another instance of Watch mode (daemon) is already running!

  Process ID: 12345
  Command: aifiles watch
  Running for: 5 minutes

To stop the existing instance:
  1. Kill the process: kill 12345
  2. Remove the lock file: rm "/Users/username/.aifiles/.aifiles-watch.lock"

Or use this command: kill 12345 && rm "/Users/username/.aifiles/.aifiles-watch.lock"
```

### ✅ Automatic Stale Lock Removal

```
🧹 Removing stale lock file from previous instance...
✅ Lock acquired! PID: 67890
```

## Code Structure

### LockFileManager Class

```typescript
class LockFileManager {
  constructor(mode: LockMode = LockMode.NORMAL)

  // Public methods
  async acquire(command: string): Promise<void>
  async release(): Promise<void>
  setupCleanupHandlers(): void
  async isLocked(): Promise<{ locked: boolean; pid?: number; command?: string }>
  getLockFilePath(): string

  // Private methods
  private isProcessRunning(pid: number): boolean
}
```

### Lockfile Data Structure

```typescript
interface LockFileData {
  pid: number;           // Process ID
  startTime: number;     // Timestamp (ms)
  command: string;       // Command executed
}
```

Example lockfile content:
```json
{
  "pid": 12345,
  "startTime": 1699999999999,
  "command": "aifiles watch"
}
```

## Integration in CLI

```typescript
// src/cli.ts

const isWatchMode = argv._.command === 'watch';
const isFileManager = argv._.command === 'filemanager';
const lockMode = isWatchMode
  ? LockMode.WATCH
  : isFileManager
  ? LockMode.FILEMANAGER
  : LockMode.NORMAL;

const lockManager = new LockFileManager(lockMode);
await lockManager.acquire(`aifiles ${commandName}`);
lockManager.setupCleanupHandlers();
```

## Usage Examples

### Example 1: Running Normal Mode Twice ❌

```bash
# Terminal 1
$ aifiles document.pdf
✅ Lock acquired! PID: 12345
# Processing...

# Terminal 2
$ aifiles photo.jpg
❌ Another instance of AIFiles is already running!
   Process ID: 12345
   ...
```

### Example 2: Running Watch + Normal ✅

```bash
# Terminal 1
$ aifiles watch
✅ Lock acquired! PID: 12345 (.aifiles-watch.lock)
# Watching...

# Terminal 2
$ aifiles document.pdf
✅ Lock acquired! PID: 67890 (.aifiles.lock)
# Processing... (works because different lockfile!)
```

### Example 3: Stale Lock Auto-Cleanup

```bash
# Scenario: Process crashed, lockfile remains

$ aifiles document.pdf
🧹 Removing stale lock file from previous instance...
✅ Lock acquired! PID: 11111
# Proceeds normally
```

## Testing

### Run the Demonstration

```bash
./test-separate-locks.sh
```

Output shows:
- ✅ Normal and watch locks created separately
- ✅ Both coexist without conflicts
- ✅ Lock file contents
- ✅ Error message preview

### Manual Testing

```bash
# Test 1: Duplicate normal mode
terminal1$ aifiles test.pdf &
terminal2$ aifiles test2.pdf  # Should error

# Test 2: Normal + Watch (should work)
terminal1$ aifiles watch &
terminal2$ aifiles test.pdf   # Should work

# Test 3: Stale lock cleanup
$ echo '{"pid": 99999, "startTime": 0, "command": "test"}' > ~/.aifiles/.aifiles.lock
$ aifiles test.pdf  # Should auto-cleanup and proceed
```

## Error Handling

### Corrupted Lockfile
If lockfile is corrupted (invalid JSON):
```
🧹 Removing corrupted lock file...
✅ Lock acquired!
```

### Permission Issues
If can't create lockfile directory:
```
❌ Error: EACCES: permission denied, mkdir '~/.aifiles'
```

### Process Still Running
If process is genuinely running:
```
❌ Another instance of AIFiles is already running!
[Full error message with kill instructions]
```

## Cleanup Behavior

| Event | Cleanup? | Method |
|-------|----------|--------|
| Normal exit | ✅ Yes | `process.on('exit')` |
| Ctrl+C (SIGINT) | ✅ Yes | `process.on('SIGINT')` |
| SIGTERM | ✅ Yes | `process.on('SIGTERM')` |
| Uncaught exception | ✅ Yes | `process.on('uncaughtException')` |
| Promise rejection | ✅ Yes | `process.on('unhandledRejection')` |
| Process crash | ❌ No | Detected as stale on next run |

## Benefits

1. **Prevents File Conflicts**: Multiple instances can't modify the same files
2. **Better User Experience**: Clear error messages with actionable instructions
3. **Automatic Cleanup**: Stale locks don't block future runs
4. **Mode Independence**: Watch mode doesn't block normal operations
5. **Robust**: Handles all exit scenarios gracefully
6. **Transparent**: Users can see exactly what's running and how to stop it

## Future Enhancements

Potential improvements:
- [ ] Web dashboard showing all running instances
- [ ] Lock file with more metadata (user, hostname, working directory)
- [ ] Graceful handoff between instances
- [ ] Batch mode support for parallel processing
- [ ] Lock file expiration (auto-cleanup after N hours)

## Troubleshooting

See [LOCKFILE.md](./LOCKFILE.md) for detailed troubleshooting guide.
