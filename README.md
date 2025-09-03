# Lost City

> [!NOTE]
> Learn about our history and ethos on our forum:
> <https://lostcity.rs/t/faq-what-is-lost-city/16>

This is a higher-level repository that links our other projects. You'll
notice it's like home-rolled submodules (without commit references).
GitHub won't include submodules in web downloads, and many users click
"Download ZIP" on the website.

## Getting Started

> [!IMPORTANT]
> If you run into issues, please see our
> [common issues](#common-issues).

1. Download and extract this repo somewhere on your computer.
2. Install our [dependencies](#dependencies).
3. Open the folder you downloaded: **Run the start script and follow the
   on-screen prompts.** You may disregard any severity warnings you see.

Once setup completes, wait for the message that the world has started
before trying to play at: <http://localhost/rs2.cgi>

You can press `ctrl + c` to cancel/quit out of a terminal process.

## Dependencies

- Git CLI — Windows users: <https://git-scm.com/>
- Node.js 22: <https://nodejs.org/>
- Java 17 or newer: <https://adoptium.net/>

> [!TIP]
> If you're using VS Code (recommended), install our extension from the
> Marketplace:
> <https://marketplace.visualstudio.com/items?itemName=2004scape.runescriptlanguage>

## Workflow

**Use the start script provided** — it handles common use cases. We're
reducing the barrier to entry with an all‑inclusive script.

## Common Issues

- `bad option: --import`

You are using an older version of Node. Reinstall and re‑run.

- `'"java"' is not recognized as an internal or external command`

You do not have Java installed.

- Error:

```
XXXXX has been compiled by a more recent version of the Java Runtime
(class file version 61.0), this version of the Java Runtime only recognizes
class file versions up to 52.0
```

You are using Java 8 or Java 11. If you have multiple Java versions, set
`JAVA_PATH=path-to-java.exe` in your `.env` file.

## License

This project is licensed under the
[MIT License](https://opensource.org/licenses/MIT). See the
[LICENSE](LICENSE) file for details.
