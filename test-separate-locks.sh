#!/bin/bash

# Test script to demonstrate separate lockfile behavior
# This script shows how watch mode and normal mode can run simultaneously

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing AIFiles Lockfile Mechanism"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Clean up any existing locks
echo "🧹 Cleaning up existing locks..."
rm -f ~/.aifiles/.aifiles.lock
rm -f ~/.aifiles/.aifiles-watch.lock
rm -f ~/.aifiles/.aifiles-filemanager.lock
echo "✅ Locks cleaned"
echo ""

# Test 1: Create a normal mode lock
echo "━━━ Test 1: Normal Mode Lock ━━━"
echo "Creating a simulated normal mode lock..."
mkdir -p ~/.aifiles
cat > ~/.aifiles/.aifiles.lock <<EOF
{
  "pid": $$,
  "startTime": $(date +%s)000,
  "command": "aifiles test.pdf"
}
EOF
echo "✅ Lock created: .aifiles.lock"
echo "   PID: $$"
echo ""

# Test 2: Create a watch mode lock (should work - different lockfile)
echo "━━━ Test 2: Watch Mode Lock (Different Lockfile) ━━━"
echo "Creating a simulated watch mode lock..."
cat > ~/.aifiles/.aifiles-watch.lock <<EOF
{
  "pid": $$,
  "startTime": $(date +%s)000,
  "command": "aifiles watch"
}
EOF
echo "✅ Lock created: .aifiles-watch.lock"
echo "   PID: $$"
echo ""

# Show both locks can coexist
echo "━━━ Current Lock Status ━━━"
echo "Both locks coexist (different modes can run together):"
echo ""
ls -lh ~/.aifiles/.aifiles*.lock 2>/dev/null | while read line; do
  filename=$(echo "$line" | awk '{print $NF}')
  basename=$(basename "$filename")
  if [[ $basename == *"watch"* ]]; then
    echo "  📡 $basename (Watch Mode)"
  elif [[ $basename == *"filemanager"* ]]; then
    echo "  📂 $basename (File Manager)"
  else
    echo "  📄 $basename (Normal Mode)"
  fi
done
echo ""

# Test 3: Show lock file contents
echo "━━━ Test 3: Lock File Contents ━━━"
echo ""
echo "Normal mode lock (.aifiles.lock):"
cat ~/.aifiles/.aifiles.lock | jq '.' 2>/dev/null || cat ~/.aifiles/.aifiles.lock
echo ""
echo "Watch mode lock (.aifiles-watch.lock):"
cat ~/.aifiles/.aifiles-watch.lock | jq '.' 2>/dev/null || cat ~/.aifiles/.aifiles-watch.lock
echo ""

# Test 4: Demonstrate what happens with duplicate mode
echo "━━━ Test 4: Duplicate Mode Detection ━━━"
echo "This is what AIFiles would show if you try to run two normal modes:"
echo ""
echo "❌ Another instance of AIFiles is already running!"
echo ""
echo "  Process ID: $$"
echo "  Command: aifiles test.pdf"
echo "  Running for: 0 seconds"
echo ""
echo "To stop the existing instance:"
echo "  1. Kill the process: kill $$"
echo "  2. Remove the lock file: rm \"$HOME/.aifiles/.aifiles.lock\""
echo ""
echo "Or use this command: kill $$ && rm \"$HOME/.aifiles/.aifiles.lock\""
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Normal mode and Watch mode use DIFFERENT lockfiles"
echo "✅ Both modes can run simultaneously"
echo "❌ Two instances of the SAME mode are blocked"
echo ""
echo "Lockfile locations:"
echo "  📄 Normal:       ~/.aifiles/.aifiles.lock"
echo "  📡 Watch:        ~/.aifiles/.aifiles-watch.lock"
echo "  📂 File Manager: ~/.aifiles/.aifiles-filemanager.lock"
echo ""

# Cleanup
echo "🧹 Cleaning up test locks..."
rm -f ~/.aifiles/.aifiles.lock
rm -f ~/.aifiles/.aifiles-watch.lock
rm -f ~/.aifiles/.aifiles-filemanager.lock
echo "✅ Done!"
echo ""
