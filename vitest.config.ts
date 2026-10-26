import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // The widget is real DOM over a faked n8n: every answer comes from a scripted `fetch`.
        include: ['src/**/*.{test,spec}.ts'],
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        // Inlined so the alias below also reaches the aparté packages' own imports of core.
        server: { deps: { inline: [/^@aparte\//] } },
    },
    resolve: {
        // vitest resolves core's `node` condition, the DOM-free entry where no element upgrades;
        // `@aparte/core/browser` is the browser entry by name, for a Node runner with a DOM.
        alias: [{ find: /^@aparte\/core$/, replacement: '@aparte/core/browser' }],
    },
});
