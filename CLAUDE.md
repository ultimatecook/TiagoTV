# Claude Code guidance

@AGENTS.md

Common rules and task routing are maintained in [AGENTS.md](AGENTS.md).
Read only the linked contracts relevant to the task. Do not add subsystem
summaries or duplicate common instructions here.

Repository release skills are mirrored in `.claude/skills/`; their Codex copies
must remain byte-identical. Other repository skill instructions can be read
from the paths in the [context map](docs/maintenance/agent-context-map.md).

## TiagoTV fork

This repository is TiagoTV, a personal fork of IPTVnator: the upstream
release-note, release and external review-gate rules do not apply. The glass
UI lives in the shell top bar (`libs/workspace/shell/feature`), the dark
theme tokens in `apps/web/src/m3-theme.scss` and
`apps/web/src/_tv-tokens.scss`, and the Home in
`libs/workspace/dashboard/feature/src/lib/rails`.
