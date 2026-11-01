import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// jsdom resolves no var(): what a page's colors reach is read in the theme's own text.
const css = readFileSync(join(process.cwd(), 'src/theme.css'), 'utf8').replace(/\r\n/g, '\n');
const declaration = (block: string, name: string) => block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
const darkBlocks = () => {
    const chosen = css.match(/\.aparte-n8n\[data-aparte-theme='dark'\] \{([^}]*)\}/)?.[1] ?? '';
    const system = css.match(/\.aparte-n8n:not\(\[data-aparte-theme\]\) \{([^}]*)\}/)?.[1] ?? '';
    return { chosen, system };
};

describe('one color is enough', () => {
    it('the button in the corner takes --secondary when the page set no --primary', () => {
        expect(declaration(css, '--aparte-n8n-toggle-bg')).toBe(
            'var(--chat--toggle--background, var(--chat--color--primary, var(--chat--color--secondary, #e74266)))',
        );
        expect(declaration(css, '--aparte-n8n-accent')).toBe('var(--chat--color--primary, var(--chat--color--secondary, #e74266))');
    });

    it('every hover is derived from the color it darkens, never n8n\'s fixed shade', () => {
        expect(css).not.toMatch(/#126a5d|#db4061/);
        expect(declaration(css, '--aparte-primary-hover')).toContain('color-mix(in oklab, var(--aparte-primary)');
        expect(declaration(css, '--aparte-n8n-toggle-hover-bg')).toContain('color-mix(in oklab, var(--aparte-n8n-toggle-bg)');
    });
});

describe('dark follows the page', () => {
    it('the chosen dark and the system\'s dark are the same declarations', () => {
        const { chosen, system } = darkBlocks();
        const normalise = (block: string) => block.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
        expect(chosen.length).toBeGreaterThan(200);
        expect(normalise(system)).toBe(normalise(chosen));
    });

    it('keeps the page\'s header color, and n8n\'s navy when it set none', () => {
        expect(declaration(darkBlocks().chosen, '--aparte-n8n-header-bg')).toBe('var(--chat--header--background, #060716)');
    });

    it('tints each surface with the page\'s color, and falls back to the navy itself', () => {
        const { chosen } = darkBlocks();
        for (const [name, navy] of [['--aparte-bg', '#0b0d24'], ['--aparte-surface-1', '#151937'], ['--aparte-border', '#262b52']]) {
            const value = declaration(chosen, name) ?? '';
            expect(value).toMatch(new RegExp(`^color-mix\\(in oklab, var\\(--chat--color--secondary, ${navy}\\) \\d+%, ${navy}\\)$`));
        }
        // The field and the footer read the surfaces, so a page that sets those sets them too.
        expect(declaration(chosen, '--aparte-n8n-input-bg')).toBe('var(--aparte-surface-1)');
        expect(declaration(chosen, '--aparte-n8n-footer-bg')).toBe('var(--aparte-bg)');
    });
});
