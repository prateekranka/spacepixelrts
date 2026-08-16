# DIRECTIVE FROM USER (read now, act immediately)

The user has observed the orchestrator is stalled and leaking sub-agents. Do these
three things **now**, in order:

1. **Reap all orphaned sub-agent processes and tmux sessions.** There are ~22 leaked
   `cursor-agent` processes and many leftover tmux sessions (`p15c`, `p16c`, `p17`,
   `p18c`, `p19`, ...) from the Wave 1 loop that never terminated. Kill them:
   - `tmux kill-session -t <name>` for every leftover `pNN` / `pNNc` session.
   - `pkill -f 'composer-2.5'` and `pkill -f 'cursor-agent'` for any process that is
     NOT the main orchestrator (do NOT kill your own PID or the `monitor` tmux session).
   Verify with `ps aux | grep composer-2.5` and `tmux ls` that only you + `monitor` remain.

2. **Re-spawn the Wave 2 integrator (P42) with a bounded timeout and direct output
   capture.** Do not rely on `AwaitShell` waiting for an `EXIT:` marker that never comes.
   Use:
   ```
   cursor-agent --trust --yolo --print --model composer-2.5 -p "$(cat tasks/P42-brief.md)" \
      > tasks/P42.md 2>&1 &
   ```
   with an explicit timeout (e.g. `timeout 600`), and poll `tasks/P42.md` for the result.
   If it does not finish, record that in PROGRESS.md and move on — do not hang forever.

3. **Always close processes when their work is done.** For every sub-agent you spawn,
   ensure it terminates (bounded timeout, kill on completion, clean up its tmux session).
   No sub-agent may be left running after it finishes. Add `set -e` + `trap`/`kill` to the
   spawn wrapper so leaked processes cannot accumulate again.

After doing 1–3, report a one-line confirmation into `PROGRESS.md` and commit it, then
resume the Wave 2 integrator loop normally.
