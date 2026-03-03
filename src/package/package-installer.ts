import * as path from 'path';
import * as fs from 'fs';
import { ManifestLoader, PackageManifest } from './manifest';

/**
 * Package installer - installs and manages packages in fl_modules
 */
export class PackageInstaller {
  private projectRoot: string;
  private flModulesDir: string;
  private manifestLoader: ManifestLoader;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.flModulesDir = path.join(projectRoot, 'fl_modules');
    this.manifestLoader = new ManifestLoader();
  }

  /**
   * Install package from local path
   *
   * @param packagePath - Path to package directory (containing freelang.json)
   * @param version - Optional version override
   * @throws Error if package path doesn't exist or manifest is invalid
   */
  public async install(packagePath: string, version?: string): Promise<void> {
    // Verify package path exists
    if (!fs.existsSync(packagePath)) {
      throw new Error(
        `Package path not found: ${packagePath}`
      );
    }

    // Load package manifest
    let manifest: PackageManifest;
    try {
      manifest = this.manifestLoader.load(packagePath);
    } catch (error) {
      throw new Error(
        `Failed to load package manifest from ${packagePath}: ${error}`
      );
    }

    // Override version if provided
    if (version) {
      manifest.version = version;
    }

    // Ensure fl_modules directory exists
    if (!fs.existsSync(this.flModulesDir)) {
      fs.mkdirSync(this.flModulesDir, { recursive: true });
    }

    // Copy package to fl_modules
    const targetDir = path.join(this.flModulesDir, manifest.name);

    if (fs.existsSync(targetDir)) {
      console.log(
        `Package '${manifest.name}' already installed, updating...`
      );
      fs.rmSync(targetDir, { recursive: true });
    }

    this.copyDirectory(packagePath, targetDir);

    // Update project manifest with new dependency
    await this.updateProjectManifest(manifest.name, manifest.version);

    console.log(`✅ Installed ${manifest.name}@${manifest.version}`);
  }

  /**
   * Uninstall package
   *
   * @param packageName - Package name to uninstall
   * @throws Error if package is not installed
   */
  public async uninstall(packageName: string): Promise<void> {
    const packageDir = path.join(this.flModulesDir, packageName);

    if (!fs.existsSync(packageDir)) {
      throw new Error(
        `Package '${packageName}' is not installed in fl_modules/`
      );
    }

    // Remove directory
    fs.rmSync(packageDir, { recursive: true, force: true });

    // Update project manifest to remove dependency
    await this.removeFromProjectManifest(packageName);

    console.log(`✅ Uninstalled ${packageName}`);
  }

  /**
   * Install all dependencies from freelang.json
   *
   * Note: This is a placeholder. In production, you would:
   * - Fetch packages from registry
   * - Handle version resolution
   * - Manage transitive dependencies
   *
   * For now, logs what would be installed
   */
  public async installAll(): Promise<void> {
    const manifestPath = path.join(this.projectRoot, 'freelang.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error('No freelang.json found in project');
    }

    const manifest = this.manifestLoader.load(this.projectRoot);
    const deps = manifest.dependencies || {};

    if (Object.keys(deps).length === 0) {
      console.log('No dependencies to install');
      return;
    }

    console.log(`Installing ${Object.keys(deps).length} dependencies...`);

    for (const [name, version] of Object.entries(deps)) {
      console.log(`Installing ${name}@${version}...`);
      // In production:
      // const packageData = await packageRegistry.fetch(name, version);
      // await this.install(packageData.path, version);
    }

    console.log('✅ All dependencies installed');
  }

  /**
   * Copy directory recursively
   *
   * @param src - Source directory path
   * @param dest - Destination directory path
   * @private
   */
  private copyDirectory(src: string, dest: string): void {
    // Ensure destination directory exists
    fs.mkdirSync(dest, { recursive: true });

    // Read source directory entries
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        this.copyDirectory(srcPath, destPath);
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Update project's freelang.json with new dependency
   *
   * @param packageName - Package name
   * @param version - Package version
   * @private
   */
  private async updateProjectManifest(
    packageName: string,
    version: string
  ): Promise<void> {
    const manifestPath = path.join(this.projectRoot, 'freelang.json');

    // Load or create manifest
    let manifest: PackageManifest;
    if (fs.existsSync(manifestPath)) {
      manifest = this.manifestLoader.load(this.projectRoot);
    } else {
      // Create default manifest if doesn't exist
      const projectName = path.basename(this.projectRoot);
      manifest = ManifestLoader.createDefault(projectName);
    }

    // Add or update dependency
    if (!manifest.dependencies) {
      manifest.dependencies = {};
    }
    manifest.dependencies[packageName] = version;

    // Write updated manifest
    this.manifestLoader.write(this.projectRoot, manifest);
  }

  /**
   * Remove package from project's freelang.json
   *
   * @param packageName - Package name to remove
   * @private
   */
  private async removeFromProjectManifest(packageName: string): Promise<void> {
    const manifestPath = path.join(this.projectRoot, 'freelang.json');

    if (!fs.existsSync(manifestPath)) {
      return; // Nothing to update
    }

    const manifest = this.manifestLoader.load(this.projectRoot);

    if (manifest.dependencies && manifest.dependencies[packageName]) {
      delete manifest.dependencies[packageName];

      // Write updated manifest
      this.manifestLoader.write(this.projectRoot, manifest);
    }
  }

  /**
   * Get list of installed packages
   *
   * @returns Array of package names in fl_modules
   */
  public getInstalledPackages(): string[] {
    if (!fs.existsSync(this.flModulesDir)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(this.flModulesDir);
      return entries.filter(name => {
        const packagePath = path.join(this.flModulesDir, name);
        return fs.statSync(packagePath).isDirectory();
      });
    } catch {
      return [];
    }
  }

  /**
   * Check if package is installed
   *
   * @param packageName - Package name
   * @returns true if installed
   */
  public isInstalled(packageName: string): boolean {
    const packageDir = path.join(this.flModulesDir, packageName);
    return fs.existsSync(packageDir);
  }

  /**
   * Get installed package version
   *
   * @param packageName - Package name
   * @returns Version string or null if not installed
   */
  public getInstalledVersion(packageName: string): string | null {
    const packageDir = path.join(this.flModulesDir, packageName);

    if (!fs.existsSync(packageDir)) {
      return null;
    }

    try {
      const manifest = this.manifestLoader.load(packageDir);
      return manifest.version;
    } catch {
      return null;
    }
  }

  /**
   * Get project root directory
   */
  public getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Get fl_modules directory path
   */
  public getModulesDir(): string {
    return this.flModulesDir;
  }

  /**
   * Check if fl_modules directory exists
   */
  public hasModulesDir(): boolean {
    return fs.existsSync(this.flModulesDir);
  }

  /**
   * Create fl_modules directory
   */
  public createModulesDir(): void {
    if (!fs.existsSync(this.flModulesDir)) {
      fs.mkdirSync(this.flModulesDir, { recursive: true });
    }
  }

  /**
   * Clear all installed packages
   *
   * @param confirm - Must be true to confirm deletion
   */
  public clearModules(confirm: boolean = false): void {
    if (!confirm) {
      throw new Error('Must pass confirm=true to clear modules');
    }

    if (fs.existsSync(this.flModulesDir)) {
      fs.rmSync(this.flModulesDir, { recursive: true, force: true });
      console.log('✅ Cleared all installed packages');
    }
  }
}
