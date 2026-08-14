# DeepSeek Harness Desktop

An unofficial macOS desktop wrapper for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It starts Harness automatically, assigns a private local port, embeds the Web UI in a desktop window, and stops the local service when the app exits.

DeepSeek Harness Desktop 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的非官方 macOS 桌面封装。双击即可启动 Harness，无需手动运行命令、管理端口或打开浏览器。

> This project is not affiliated with or endorsed by DeepSeek AI.

## Features

- Starts the bundled Harness runtime automatically.
- Uses an OS-assigned port bound only to `127.0.0.1`.
- Opens the existing Harness Web UI in a standalone desktop window.
- Keeps Harness settings and sessions in the macOS application-data directory.
- Shuts down the Harness process when the desktop app exits.
- Shows actionable startup logs and supports one-click restart.
- Repairs missing dependencies for locally linked Harness plugins when the required package is bundled with the app.
- Pins `@deepseek-ai/dsh` to a tested version.
- Verifies packaged Harness peer dependencies during every release build.

## Install

The current release supports Apple Silicon Macs (M1, M2, M3, M4, and later ARM-based Macs).

1. Download the latest `.dmg` from [Releases](https://github.com/johalqian/deepseek-harness-desktop/releases).
2. Open the DMG and drag **DeepSeek Harness Desktop** into Applications.
3. The build is not Apple-notarized. On first launch, right-click the app in Finder and choose **Open**.
4. In Harness, open **Settings → Models** and configure your model provider and API key.
5. Choose a workspace before starting a session.

The API key is stored by Harness in its local application data; it is not included in this repository or the installer.

## How it works

```text
Desktop app
  ├─ starts the bundled Electron/Node runtime
  ├─ launches dsh web on an automatically assigned loopback port
  ├─ loads the local Harness Web UI
  └─ terminates Harness when the app quits
```

The app still uses a local HTTP server internally because that is how the upstream Harness Web UI communicates with its runtime. The port is automatic, loopback-only, and normally invisible to the user.

## Development

Requirements:

- macOS on Apple Silicon
- Node.js `^22.19.0` or `>=24.0.0`
- npm

Run locally:

```bash
npm install
npm start
```

Build the DMG and ZIP:

```bash
npm run dist:mac
```

Artifacts are written to `dist/`. The build command fails if electron-builder removes any required DeepSeek Harness peer dependency.

## Local data

Harness configuration and sessions are stored under Electron's macOS user-data directory, normally:

```text
~/Library/Application Support/deepseek-harness-desktop/
```

Removing the application does not automatically remove this data.

## Security model

DeepSeek Harness is a coding agent that can read files, modify a selected workspace, and run commands under its configured permission policy. This desktop wrapper:

- keeps the server bound to `127.0.0.1`;
- uses a random available port;
- blocks untrusted navigation inside the desktop window;
- opens external links in the system browser;
- does not add remote-network access or authentication endpoints.

Review tool approvals and use version control for important projects.

## Upstream status

DeepSeek Harness is currently a developer preview and may make compatibility-breaking changes. This repository intentionally pins a known Harness release and updates it only after desktop packaging tests pass.

## License

MIT. See [LICENSE](LICENSE).
