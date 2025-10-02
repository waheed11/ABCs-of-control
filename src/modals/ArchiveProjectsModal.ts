import { App, Modal, Notice, TFolder, TFile, normalizePath } from 'obsidian';
import { ArchiveHandler } from '../handlers/archiveHandler';
import { ensureFolderExists, confirmModal } from '../utils';

/**
 * Modal for archiving specific D projects/exams to E
 */
export class ArchiveProjectsModal extends Modal {
    private selectedItems: Map<string, boolean> = new Map();

    constructor(app: App) {
        super(app);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('abcs-of-control-modal');

        contentEl.createEl('h2', { text: '📁 Archive Projects/Exams' });
        contentEl.createEl('p', { 
            text: 'Select D sub-folders to move to E/Archive. Templates will be moved to E/Templates.',
            cls: 'archive-description'
        });

        // Scan D folder for sub-folders
        const dFolders = await this.scanDFolders();

        if (dFolders.length === 0) {
            contentEl.createEl('p', { text: 'No projects or exams found in D folder.' });
            const closeBtn = contentEl.createEl('button', { text: 'Close' });
            closeBtn.addEventListener('click', () => this.close());
            return;
        }

        // List of folders with checkboxes
        const listContainer = contentEl.createDiv({ cls: 'archive-project-list' });
        const folderCheckboxes: HTMLInputElement[] = [];

        for (const folder of dFolders) {
            const itemDiv = listContainer.createDiv({ cls: 'archive-project-item' });
            const checkbox = itemDiv.createEl('input', {
                type: 'checkbox',
                attr: { id: `folder-${folder.path}` }
            });
            checkbox.checked = false;
            folderCheckboxes.push(checkbox);
            
            this.selectedItems.set(folder.path, false);

            const label = itemDiv.createEl('label', {
                attr: { for: `folder-${folder.path}` }
            });

            // Icon based on folder type
            const icon = folder.path.includes('/Projects') ? '📂' : 
                        folder.path.includes('/Exams') ? '📚' : '📁';
            label.createSpan({ text: `${icon} ${folder.path}` });

            // Count files in folder
            const fileCount = this.countFiles(folder);
            if (fileCount > 0) {
                label.createSpan({ 
                    text: ` (${fileCount} file${fileCount !== 1 ? 's' : ''})`,
                    cls: 'file-count'
                });
            }

            checkbox.addEventListener('change', () => {
                this.selectedItems.set(folder.path, checkbox.checked);
            });
        }

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
        
        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const archiveBtn = buttonContainer.createEl('button', { 
            text: 'Archive Selected',
            cls: 'mod-warning'
        });
        archiveBtn.addEventListener('click', async () => {
            await this.handleArchive();
        });
    }

    private async scanDFolders(): Promise<TFolder[]> {
        const folders: TFolder[] = [];
        
        // Start from D root and scan recursively
        const dRoot = this.app.vault.getAbstractFileByPath('D');
        if (dRoot && dRoot instanceof TFolder) {
            this.scanFolderRecursively(dRoot, folders, 0);
        }

        return folders.sort((a, b) => a.path.localeCompare(b.path));
    }

    private scanFolderRecursively(folder: TFolder, result: TFolder[], depth: number) {
        // Don't go too deep (max 2 levels under D)
        if (depth > 2) return;

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                // Add the folder itself if it's not the D root
                if (depth > 0) {
                    result.push(child);
                }
                // Recursively scan its children
                this.scanFolderRecursively(child, result, depth + 1);
            }
        }
    }

    private countFiles(folder: TFolder): number {
        let count = 0;
        for (const child of folder.children) {
            if (child instanceof TFile) {
                count++;
            } else if (child instanceof TFolder) {
                count += this.countFiles(child);
            }
        }
        return count;
    }

    private async handleArchive() {
        const selected = Array.from(this.selectedItems.entries())
            .filter(([_, checked]) => checked)
            .map(([path, _]) => path);

        if (selected.length === 0) {
            new Notice('Please select at least one folder to archive');
            return;
        }

        // Confirm
        const confirmed = await confirmModal(
            this.app,
            'Archive Projects/Exams',
            `Archive ${selected.length} folder${selected.length !== 1 ? 's' : ''} to E/Archive?\n\nThis will:\n- Move folders to E/Archive\n- Move associated templates to E/Templates`,
            'Archive',
            'Cancel'
        );

        if (!confirmed) return;

        try {
            const archiveHandler = new ArchiveHandler(this.app);
            let successCount = 0;
            let failCount = 0;

            for (const folderPath of selected) {
                try {
                    await this.archiveFolder(folderPath);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to archive ${folderPath}:`, err);
                    failCount++;
                }
            }

            if (successCount > 0) {
                new Notice(`✅ Archived ${successCount} folder${successCount !== 1 ? 's' : ''}`);
            }
            if (failCount > 0) {
                new Notice(`❌ Failed to archive ${failCount} folder${failCount !== 1 ? 's' : ''}`);
            }

            this.close();
        } catch (err) {
            console.error('Archive error:', err);
            new Notice('❌ Failed to archive folders. See console for details.');
        }
    }

    private async archiveFolder(folderPath: string) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder || !(folder instanceof TFolder)) {
            throw new Error(`Folder not found: ${folderPath}`);
        }

        // Determine destination based on source
        let destPath: string;
        if (folderPath.includes('/Projects/')) {
            const folderName = folder.name;
            destPath = normalizePath(`E/Archive/Projects/${folderName}`);
        } else if (folderPath.includes('/Exams/')) {
            const folderName = folder.name;
            destPath = normalizePath(`E/Archive/Exams/${folderName}`);
        } else {
            // Generic D subfolder
            const folderName = folder.name;
            destPath = normalizePath(`E/Archive/${folderName}`);
        }

        // Ensure parent folder exists
        const parentPath = destPath.substring(0, destPath.lastIndexOf('/'));
        await ensureFolderExists(this.app, parentPath);

        // Handle naming conflicts
        let finalDestPath = destPath;
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(finalDestPath)) {
            const baseName = folder.name;
            const parentDir = destPath.substring(0, destPath.lastIndexOf('/'));
            finalDestPath = normalizePath(`${parentDir}/${baseName} (${counter})`);
            counter++;
        }

        // Move the folder
        await this.app.fileManager.renameFile(folder, finalDestPath);

        // Try to move associated template
        await this.moveAssociatedTemplate(folder.name);
    }

    private async moveAssociatedTemplate(entityName: string) {
        // Common template patterns
        const patterns = [
            `Content-to-D-Projects-${entityName}.md`,
            `Tips-to-D-Exams-${entityName}.md`,
            `MPipeline-${entityName}.md`
        ];

        for (const pattern of patterns) {
            const templatePath = normalizePath(`C/Templates/${pattern}`);
            const template = this.app.vault.getAbstractFileByPath(templatePath);
            
            if (template && template instanceof TFile) {
                await ensureFolderExists(this.app, 'E/Templates');
                
                let destPath = normalizePath(`E/Templates/${template.name}`);
                let counter = 1;
                while (this.app.vault.getAbstractFileByPath(destPath)) {
                    const baseName = template.name.replace(/\.md$/, '');
                    destPath = normalizePath(`E/Templates/${baseName} (${counter}).md`);
                    counter++;
                }
                
                await this.app.fileManager.renameFile(template, destPath);
            }
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
