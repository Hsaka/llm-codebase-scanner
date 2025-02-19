#!/usr/bin/env node

/**
 * @fileoverview A command-line tool for scanning and documenting codebases.
 * This tool analyzes project structure, reads source files, and generates 
 * comprehensive markdown documentation including solution files analysis for .NET projects.
 * 
 * @requires fs.promises
 * @requires path
 * @requires xml2js
 * @requires commander
 * @requires picocolors
 */

const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const { program } = require('commander');
const colors = require('picocolors');

/**
 * @class ConsoleSpinner
 * @description Provides an animated spinner for console output to indicate ongoing operations.
 * Includes methods for starting, stopping, and updating the spinner with success/failure states.
 */
class ConsoleSpinner {
    /**
     * @constructor
     * @param {string} message - The message to display alongside the spinner
     */
    constructor(message) {
        this.message = message;
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.interval = null;
        this.currentFrame = 0;
    }

    /**
     * Starts the spinner animation
     * @returns {ConsoleSpinner} - Returns this instance for method chaining
     */
    start() {
        process.stdout.write('\x1B[?25l'); // Hide cursor
        this.interval = setInterval(() => {
            process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 80);
        return this;
    }

    /**
     * Stops the spinner animation
     * @returns {ConsoleSpinner} - Returns this instance for method chaining
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            process.stdout.write('\x1B[?25h'); // Show cursor
            process.stdout.write('\r');
        }
        return this;
    }

    /**
     * Stops the spinner and displays a success message
     * @param {string} message - The success message to display
     * @returns {ConsoleSpinner} - Returns this instance for method chaining
     */
    succeed(message) {
        this.stop();
        console.log(`${colors.green('✓')} ${message}`);
        return this;
    }

    /**
     * Stops the spinner and displays a failure message
     * @param {string} message - The failure message to display
     * @returns {ConsoleSpinner} - Returns this instance for method chaining
     */
    fail(message) {
        this.stop();
        console.log(`${colors.red('✖')} ${message}`);
        return this;
    }

    /**
     * Updates the spinner's message
     * @param {string} message - The new message to display
     * @returns {ConsoleSpinner} - Returns this instance for method chaining
     */
    text(message) {
        this.message = message;
        return this;
    }
}

/**
 * @class CodebaseScanner
 * @description Main class for scanning and analyzing codebases.
 * Handles directory traversal, file analysis, and markdown generation.
 */
class CodebaseScanner {
    /**
     * @constructor
     * @param {Object} options - Configuration options
     * @param {string[]} [options.ignoreDirs] - Directories to ignore during scanning
     * @param {string[]} [options.fileExtensions] - File extensions to include in scanning
     * @param {boolean} [options.verbose] - Enable verbose logging
     */
    constructor(options = {}) {
        this.ignoreDirs = new Set(options.ignoreDirs || [
            '.git',
            'node_modules',
            'dist',
            'build',
            'bin',
            'obj',
            'packages',
            '.vs'
        ]);

        this.fileExtensions = new Set(options.fileExtensions || [
            // C# and .NET files
            '.cs',
            '.csproj',
            '.sln',
            '.config',
            '.cshtml',
            '.razor',
            // Web files
            '.html',
            '.css',
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            // Other common source files
            '.py',
            '.java',
            '.cpp',
            '.h'
        ]);

        this.verbose = options.verbose || false;
    }

    /**
     * Logs a message if verbose mode is enabled
     * @param {string} message - The message to log
     * @private
     */
    log(message) {
        if (this.verbose) {
            console.log(colors.blue('info:'), message);
        }
    }

    /**
     * Scans a directory and generates markdown documentation
     * @param {string} dirPath - The directory path to scan
     * @returns {Promise<string>} - The generated markdown content
     */
    async scanDirectory(dirPath) {
        let markdown = '# Codebase Structure\n\n';

        // Find solution file if it exists
        const slnFiles = await this.findFiles(dirPath, '.sln');
        if (slnFiles.length > 0) {
            markdown += '## Solution Structure\n\n';
            for (const slnFile of slnFiles) {
                markdown += await this.analyzeSolutionFile(slnFile);
            }
        }

        const structure = await this.buildStructure(dirPath);
        markdown += '\n## Directory Structure\n\n';
        markdown += this.generateStructureMarkdown(structure);
        markdown += '\n# Source Code\n\n';
        markdown += await this.generateSourceCodeMarkdown(structure);
        return markdown;
    }

    /**
     * Recursively finds files with a specific extension
     * @param {string} dirPath - The directory to search in
     * @param {string} extension - The file extension to search for
     * @returns {Promise<string[]>} - Array of matching file paths
     * @private
     */
    async findFiles(dirPath, extension) {
        const files = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (!this.ignoreDirs.has(entry.name)) {
                    files.push(...await this.findFiles(fullPath, extension));
                }
            } else if (path.extname(entry.name) === extension) {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * Analyzes a .NET solution file
     * @param {string} slnPath - Path to the solution file
     * @returns {Promise<string>} - Markdown content describing the solution
     * @private
     */
    async analyzeSolutionFile(slnPath) {
        let markdown = `### Solution: ${path.basename(slnPath)}\n\n`;
        try {
            const content = await fs.readFile(slnPath, 'utf-8');
            const projects = [];

            // Parse solution file
            const projectLines = content.split('\n').filter(line =>
                line.includes('Project("{') && line.includes('.csproj")')
            );

            for (const line of projectLines) {
                const match = line.match(/"([^"]+\.csproj)"/);
                if (match) {
                    const projPath = path.join(path.dirname(slnPath), match[1]);
                    if (await fs.access(projPath).then(() => true).catch(() => false)) {
                        projects.push(projPath);
                        markdown += await this.analyzeProjectFile(projPath);
                    }
                }
            }
        } catch (error) {
            markdown += `Error analyzing solution file: ${error.message}\n\n`;
        }
        return markdown;
    }

    /**
     * Analyzes a .NET project file
     * @param {string} csprojPath - Path to the project file
     * @returns {Promise<string>} - Markdown content describing the project
     * @private
     */
    async analyzeProjectFile(csprojPath) {
        let markdown = `#### Project: ${path.basename(csprojPath)}\n\n`;
        try {
            const content = await fs.readFile(csprojPath, 'utf-8');
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(content);

            // Extract target framework
            const targetFramework = result.Project?.PropertyGroup?.[0]?.TargetFramework?.[0];
            if (targetFramework) {
                markdown += `- Target Framework: ${targetFramework}\n`;
            }

            // Extract package references
            const packageRefs = result.Project?.ItemGroup?.[0]?.PackageReference;
            if (packageRefs && packageRefs.length > 0) {
                markdown += '- Package References:\n';
                for (const pkg of packageRefs) {
                    markdown += `  - ${pkg.$.Include} (${pkg.$.Version})\n`;
                }
            }

            markdown += '\n';
        } catch (error) {
            markdown += `Error analyzing project file: ${error.message}\n\n`;
        }
        return markdown;
    }

    /**
     * Builds a tree structure of the codebase
     * @param {string} dirPath - The directory path to analyze
     * @param {number} [level=0] - Current directory depth
     * @returns {Promise<Object|null>} - Tree structure object or null if ignored
     * @private
     */
    async buildStructure(dirPath, level = 0) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const dirName = path.basename(dirPath);

        // Skip this directory if it's in the ignore list
        if (this.ignoreDirs.has(dirName)) {
            return null;
        }

        const structure = {
            path: dirPath,
            name: dirName,
            type: 'directory',
            level,
            children: []
        };

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subStructure = await this.buildStructure(fullPath, level + 1);
                if (subStructure) {  // Only add if not null (not ignored)
                    structure.children.push(subStructure);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (!this.fileExtensions.has(ext)) continue;

                structure.children.push({
                    path: fullPath,
                    name: entry.name,
                    type: 'file',
                    level: level + 1
                });
            }
        }

        // Sort children: directories first, then files, both alphabetically
        structure.children.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });

        return structure;
    }

    /**
     * Generates markdown representation of the directory structure
     * @param {Object} structure - Tree structure object
     * @param {string} [prefix=''] - Prefix for indentation
     * @returns {string} - Markdown content
     * @private
     */
    generateStructureMarkdown(structure, prefix = '') {
        if (!structure) return '';

        let markdown = '';

        if (structure.type === 'directory') {
            if (prefix) {
                markdown += `${prefix}📁 ${structure.name}/\n`;
            }

            structure.children.forEach(child => {
                markdown += this.generateStructureMarkdown(child, prefix + '  ');
            });
        } else {
            markdown += `${prefix}📄 ${structure.name}\n`;
        }

        return markdown;
    }

    /**
     * Generates markdown documentation for source code files
     * @param {Object} structure - Tree structure object
     * @returns {Promise<string>} - Markdown content
     * @private
     */
    async generateSourceCodeMarkdown(structure) {
        let markdown = '';

        if (structure.type === 'file') {
            try {
                const content = await fs.readFile(structure.path, 'utf-8');
                const relativePath = path.relative(process.cwd(), structure.path);
                markdown += `## ${relativePath}\n\n\`\`\`${this.getLanguage(structure.path)}\n${content}\n\`\`\`\n\n`;
            } catch (error) {
                this.log(`Error reading file ${structure.path}: ${error.message}`);
                markdown += `## ${structure.path}\n\nError reading file: ${error.message}\n\n`;
            }
        } else if (structure.type === 'directory') {
            for (const child of structure.children) {
                markdown += await this.generateSourceCodeMarkdown(child);
            }
        }

        return markdown;
    }

    /**
     * Determines the programming language based on file extension
     * @param {string} filePath - Path to the file
     * @returns {string} - Language identifier for syntax highlighting
     * @private
     */
    getLanguage(filePath) {
        const ext = path.extname(filePath);
        const languageMap = {
            '.cs': 'csharp',
            '.csproj': 'xml',
            '.sln': 'text',
            '.config': 'xml',
            '.cshtml': 'cshtml',
            '.razor': 'cshtml',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.html': 'html',
            '.css': 'css',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.h': 'cpp'
        };
        return languageMap[ext] || '';
    }
}

/**
 * Main function that handles command-line interface and executes the scanner
 * @returns {Promise<void>}
 */
async function main() {
    program
        .name('codebase-scanner')
        .description('Generate markdown documentation from your codebase')
        .version('1.0.2')
        .option('-i, --input <path>', 'Input directory path', process.cwd())
        .option('-o, --output <path>', 'Output markdown file path', 'codebase-documentation.md')
        .option('-v, --verbose', 'Enable verbose logging', false)
        .option('--ignore <dirs>', 'Comma-separated list of directories to ignore')
        .option('--extensions <exts>', 'Comma-separated list of file extensions to include')
        .option('--no-solution', 'Skip solution file analysis')
        .parse();

    const options = program.opts();

    try {
        // Initialize spinner for progress indication
        const spinner = new ConsoleSpinner('Scanning codebase...').start();

        const scannerOptions = {
            verbose: options.verbose
        };

        // Parse custom file extensions if provided
        if (options.extensions) {
            scannerOptions.fileExtensions = options.extensions
                .split(',')
                .map(ext => ext.trim())
                .map(ext => ext.startsWith('.') ? ext : `.${ext}`);
        }

        // Initialize scanner with options
        const scanner = new CodebaseScanner(scannerOptions);

        // Add custom ignore directories if provided
        if (options.ignore) {
            options.ignore.split(',')
                .map(dir => dir.trim())
                .forEach(dir => scanner.ignoreDirs.add(dir));
        }

        // Update spinner and analyze codebase
        spinner.text('Analyzing codebase structure...');
        const markdown = await scanner.scanDirectory(options.input);

        // Write generated documentation to file
        spinner.text('Writing documentation...');
        await fs.writeFile(options.output, markdown);

        // Display success message
        spinner.succeed(colors.green(`Documentation generated successfully at ${options.output}`));
    } catch (error) {
        spinner.fail(colors.red('Error generating documentation'));
        console.error(colors.red(error.message));
        process.exit(1);
    }
}


// Only run if called directly from command line
if (require.main === module) {
    main();
}