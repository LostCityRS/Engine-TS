<div align="center">
    <h1>Lost City - July 13, 2004</h1>
</div>

> [!NOTE]
> Learn about our history and ethos on our forum: https://lostcity.rs/t/faq-what-is-lost-city/16

Reverse-engineered engine code designed to accurately simulate the cycle behaviors of early RS2. Contains the necessary data tools and compatible network protocol.

Game data is in the [Content](https://github.com/LostCityRS/Content) repository.

The project organizes historical versions into branches. You will need matching engine and content branches together to run the project.

## Getting Started

> [!IMPORTANT]
> If you run into issues, please see our [common issues](#common-issues).

The [Server](https://github.com/LostCityRS/Server) repository will simplify setup for most users. Download that repository and follow the instructions there.

### Manual Setup

In absence of the [Server](https://github.com/LostCityRS/Server) scripts, download the specific engine and content repositories/branches you desire and extract them to the same parent folder.

```sh
git clone https://github.com/LostCityRS/Engine-TS -b 245.2 --single-branch engine
git clone https://github.com/LostCityRS/Content -b 245.2 --single-branch content
cd engine
bun start
```

\* *use `--single-branch` when you don't need to track the commit history of all versions*

### Client

[Client-Java](https://github.com/LostCityRS/Client-Java) is available for all versions. This is a research project to decompile and understand the original code. It has minor fixes for OS and Java compatibility.

[Client-TS](https://github.com/LostCityRS/Client-TS) may be available depending on the version. This is a human-driven port of the original code to modern browsers. This gets prebuilt and included in this repository if available.

You can use the original obfuscated compiled applet from this time period with these arguments: `java -cp runescape.jar client 10 0 highmem members 32`  
Be aware it may have compatibility issues (that are addressed in the Client-Java repository).

## Dependencies

- [Bun 1.2](https://bun.sh)
- [Java 17](https://adoptium.net) - later LTS versions are also fine.

> [!TIP]
> If you're using VS Code (recommended), [we have an extension to install on the marketplace.](https://marketplace.visualstudio.com/items?itemName=2004scape.runescriptlanguage)

## Workflow

Content developers should run `bun start`. The server will watch for changes to scripts and configs, then automatically repack everything.

Engine developers should run `bun dev`. This does what `bun start` does above, but also completely restarts the server when engine code has changed.

## Common Issues

* `'"java"' is not recognized as an internal or external command`  

You do not have Java installed. See [dependencies](#dependencies) above.

* `XXXXX has been compiled by a more recent version of the Java Runtime (class file version 61.0), this version of the Java Runtime only recognizes class file versions up to 52.0`  

You are using Java 8 or Java 11. If you have multiple Java versions, you will need to set `JAVA_PATH=path-to-java.exe` in your .env file manually.

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [LICENSE](LICENSE) file for details.
