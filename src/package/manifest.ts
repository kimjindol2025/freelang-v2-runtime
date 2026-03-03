import * as fs from 'fs';
import * as path from 'path';

/**
 * Package manifest structure for freelang.json
 */
export interface PackageManifest {
  name: string;
  version: string;
  description?: string;
  main?: string;                                    // Entry point (default: ./src/index.fl)
  dependencies?: Record<string, string>;            // name -> version
  devDependencies?: Record<string, string>;
  author?: string;
  license?: string;
  repository?: string;
}

/**
 * Manifest loader for parsing and managing freelang.json files
 */
export class ManifestLoader {
  /**
   * Load and parse freelang.json from project directory
   *
   * @param projectDir - Path to project directory containing freelang.json
   * @returns Parsed PackageManifest
   * @throws Error if freelang.json not found or invalid
   */
  public load(projectDir: string): PackageManifest {
    const manifestPath = path.join(projectDir, 'freelang.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(
        `No freelang.json found in ${projectDir}\n` +
        `Run: freelang init <project-name>`
      );
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as PackageManifest;

      // Validate manifest structure
      this.validate(manifest);

      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `Invalid JSON in freelang.json: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Validate manifest structure
   *
   * @param manifest - Manifest to validate
   * @throws Error if manifest is invalid
   */
  private validate(manifest: any): void {
    if (!manifest.name) {
      throw new Error('Package name is required in freelang.json');
    }

    if (typeof manifest.name !== 'string') {
      throw new Error('Package name must be a string');
    }

    if (!manifest.version) {
      throw new Error('Package version is required in freelang.json');
    }

    if (typeof manifest.version !== 'string') {
      throw new Error('Package version must be a string');
    }

    // Validate semver format (major.minor.patch)
    if (!this.isValidSemver(manifest.version)) {
      throw new Error(
        `Invalid version format: ${manifest.version}\n` +
        `Expected format: major.minor.patch (e.g., 1.0.0)`
      );
    }

    // Validate optional fields
    if (manifest.main && typeof manifest.main !== 'string') {
      throw new Error('main must be a string');
    }

    if (manifest.description && typeof manifest.description !== 'string') {
      throw new Error('description must be a string');
    }

    if (manifest.author && typeof manifest.author !== 'string') {
      throw new Error('author must be a string');
    }

    if (manifest.license && typeof manifest.license !== 'string') {
      throw new Error('license must be a string');
    }

    if (manifest.repository && typeof manifest.repository !== 'string') {
      throw new Error('repository must be a string');
    }

    // Validate dependency objects
    if (manifest.dependencies && typeof manifest.dependencies !== 'object') {
      throw new Error('dependencies must be an object');
    }

    if (manifest.devDependencies && typeof manifest.devDependencies !== 'object') {
      throw new Error('devDependencies must be an object');
    }

    // Validate dependency versions
    if (manifest.dependencies) {
      for (const [name, version] of Object.entries(manifest.dependencies)) {
        if (typeof version !== 'string') {
          throw new Error(
            `Dependency version must be a string: ${name}=${version}`
          );
        }
      }
    }

    if (manifest.devDependencies) {
      for (const [name, version] of Object.entries(manifest.devDependencies)) {
        if (typeof version !== 'string') {
          throw new Error(
            `Dev dependency version must be a string: ${name}=${version}`
          );
        }
      }
    }
  }

  /**
   * Check if version string is valid semver (major.minor.patch)
   *
   * @param version - Version string to validate
   * @returns true if valid semver format
   */
  private isValidSemver(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * Write manifest to freelang.json
   *
   * @param projectDir - Project directory to write to
   * @param manifest - Manifest to write
   */
  public write(projectDir: string, manifest: PackageManifest): void {
    // Validate before writing
    this.validate(manifest);

    const manifestPath = path.join(projectDir, 'freelang.json');

    // Ensure directory exists
    fs.mkdirSync(projectDir, { recursive: true });

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2) + '\n',
      'utf-8'
    );
  }

  /**
   * Create default package manifest
   *
   * @param name - Package name
   * @param options - Optional configuration
   * @returns Default PackageManifest
   */
  public static createDefault(
    name: string,
    options?: {
      version?: string;
      description?: string;
      author?: string;
      license?: string;
    }
  ): PackageManifest {
    return {
      name,
      version: options?.version || '1.0.0',
      description: options?.description || '',
      main: './src/index.fl',
      dependencies: {},
      devDependencies: {},
      author: options?.author || '',
      license: options?.license || 'MIT',
    };
  }

  /**
   * Check if manifest file exists in directory
   *
   * @param projectDir - Project directory to check
   * @returns true if freelang.json exists
   */
  public static exists(projectDir: string): boolean {
    return fs.existsSync(path.join(projectDir, 'freelang.json'));
  }

  /**
   * Get main entry point from manifest
   *
   * @param manifest - Package manifest
   * @returns Path to main entry point file
   */
  public static getMainFile(manifest: PackageManifest): string {
    return manifest.main || './src/index.fl';
  }

  /**
   * Get all dependencies (both regular and dev)
   *
   * @param manifest - Package manifest
   * @param includeDev - Include dev dependencies (default: false)
   * @returns Record of package name -> version
   */
  public static getDependencies(
    manifest: PackageManifest,
    includeDev: boolean = false
  ): Record<string, string> {
    const deps: Record<string, string> = {
      ...(manifest.dependencies || {}),
    };

    if (includeDev) {
      Object.assign(deps, manifest.devDependencies || {});
    }

    return deps;
  }
}
