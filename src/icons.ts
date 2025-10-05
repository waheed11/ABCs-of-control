import { addIcon } from 'obsidian';

export const ABCS_ICON_ID = 'abcs-logo';

/**
 * Registers the plugin's custom icons with Obsidian.
 * The ABCs logo is a minimal, theme-aware outline that matches Lucide's style.
 */
export function registerIcons(): void {
	addIcon(
		ABCS_ICON_ID,
		`
	 <svg width="144" height="144" stroke="currentColor" fill="currentColor" viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  
  <!-- Corner letters -->
  <text x="3" y="25" font-family="Arial, sans-serif" font-size="36" font-weight="bold" >A</text>
  <text x="52" y="25" font-family="Arial, sans-serif" font-size="36" font-weight="bold" >B</text>
  <text x="3" y="95" font-family="Arial, sans-serif" font-size="36" font-weight="bold" >D</text>
  <text x="52" y="95" font-family="Arial, sans-serif" font-size="36" font-weight="bold" >E</text>

  <!-- Center letter -->
  <text x="38" y="53" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="40" font-weight="bold" >C</text>
</svg>

	`.trim()
	);
}
