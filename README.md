# LLM Codebase Scanner

A powerful command-line tool for scanning and documenting codebases, with special support for .NET solutions.

## Features

- 📁 Generates comprehensive markdown documentation of your codebase structure
- 🔍 Analyzes .NET solution and project files
- 📝 Creates detailed source code documentation
- 🎨 Beautiful console output with progress indicators
- 🎯 Configurable file extensions and ignore patterns

## Installation

```bash
npm install -g llm-codebase-scanner
```

## Usage

```bash
llm-codebase-scanner [options]
```

### Options

- `-i, --input <path>` - Input directory path (default: current directory)
- `-o, --output <path>` - Output markdown file path (default: codebase-documentation.md)
- `-v, --verbose` - Enable verbose logging
- `--ignore <dirs>` - Comma-separated list of directories to ignore
- `--extensions <exts>` - Comma-separated list of file extensions to include
- `--no-solution` - Skip solution file analysis
- `--version` - Show version number
- `--help` - Show help

### Examples

Scan current directory:
```bash
llm-codebase-scanner
```

Scan specific directory:
```bash
llm-codebase-scanner -i /path/to/project
```

Customize ignored directories:
```bash
llm-codebase-scanner --ignore "node_modules,dist,build"
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
