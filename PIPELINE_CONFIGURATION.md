# Pipeline Configuration Guide

## Overview

The ABCs of Control plugin now supports **fully configurable pipelines**. Pipelines define how content flows from templates to target files in your vault.

## Default Pipelines

The plugin comes with two pre-configured pipelines:

1. **Content to D/Projects**
   - Template Prefix: `Content-to-D-Projects-`
   - Target Path: `D/Projects/{project}/Content.md`
   - Source Roles: A, B

2. **Tips to D/Exams**
   - Template Prefix: `Tips-to-D-Exams-`
   - Target Path: `D/Exams/{exam}/Tips.md`
   - Source Roles: A, B

These defaults can be edited or deleted if you prefer different configurations.

## Managing Pipelines

### Adding a New Pipeline

1. Open **Settings** → **ABCs of Control**
2. Scroll to the **Pipeline Configuration** section
3. Click **➕ Add Pipeline**
4. Configure the new pipeline:
   - **Label**: Display name (e.g., "Notes to Projects")
   - **Template Prefix**: What template files start with (e.g., "Notes-to-Projects-")
   - **Target Path Pattern**: Where content goes (e.g., `D/Projects/{project}/Notes.md`)
   - **Source Roles**: Which folders to search (e.g., A, B)
   - **Include Archive Folder Notes**: Whether to include archived notes
   - **Keep Modal Open After Insert**: Modal behavior
   - **Reset Fields After Insert**: Clear selections after inserting

### Editing a Pipeline

Simply modify any field in the pipeline settings. Changes are saved automatically.

### Deleting a Pipeline

Click the **🗑️ Delete** button at the top of any pipeline card. This action cannot be undone.

## Target Path Patterns

Target paths support placeholders that get replaced based on your template name:

- `{project}` - Extracted from template name
- `{exam}` - Extracted from template name
- `{name}` - Generic placeholder
- Any custom placeholder you define

### Example

Template: `Content-to-D-Projects-YouTube Channel.md`
Target Path: `D/Projects/{project}/Content.md`
Result: `D/Projects/YouTube Channel/Content.md`

## Template Naming Convention

For pipelines to work, your template files must follow this pattern:

```
[Template Prefix][Entity Name].md
```

Examples:
- `Content-to-D-Projects-YouTube Channel.md`
- `Tips-to-D-Exams-Math Final.md`
- `Notes-to-Projects-Website Redesign.md`

## Source Roles

Source roles determine which folders the pipeline searches for notes:

- **A**: Permanent notes folders
- **B**: Literature notes folders
- **D**: Projects/Active work folders
- **E**: Archive folder

You can specify multiple roles (comma-separated): `A, B, D`

## Advanced Configuration

### Include Archive Folder Notes

Toggle whether the pipeline includes notes from Archive folders by default. Users can override this in the modal.

### Modal Behavior

- **Keep Modal Open**: Modal stays open after insertion (useful for multiple insertions)
- **Reset Fields**: Clear selected notes/text after successful insertion

## Use Cases

### Example 1: Research Notes Pipeline

- **Label**: Research to Projects
- **Prefix**: `Research-to-Projects-`
- **Target**: `D/Projects/{project}/Research.md`
- **Sources**: A, B

### Example 2: Meeting Notes Pipeline

- **Label**: Meetings to Projects
- **Prefix**: `Meetings-to-Projects-`
- **Target**: `D/Projects/{project}/Meetings.md`
- **Sources**: B

### Example 3: Resources Pipeline

- **Label**: Resources to Exams
- **Prefix**: `Resources-to-Exams-`
- **Target**: `D/Exams/{exam}/Resources.md`
- **Sources**: A, B, D

## Troubleshooting

### Pipeline Not Showing in Modal

1. Verify template file exists in `C/Templates`
2. Check template name starts with the configured prefix
3. Reload the plugin after configuration changes

### Content Not Inserting

1. Ensure target path pattern is correct
2. Verify the entity folder exists (e.g., `D/Projects/YouTube Channel`)
3. Check that source roles are configured correctly

### Placeholder Not Replaced

1. Ensure placeholder in target path matches the pattern (e.g., `{project}`)
2. Verify template name follows the naming convention
3. Check for typos in the placeholder name

## Notes

- Changes to pipeline configuration require a plugin reload to take effect
- The two default pipelines can be modified or deleted
- Pipeline IDs are auto-generated and cannot be changed
- You can create unlimited custom pipelines
