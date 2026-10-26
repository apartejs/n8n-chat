/**
 * Code in an answer, highlighted — loaded the first time an answer holds code, so a page
 * whose visitors never see a code block never downloads a grammar.
 *
 * A fixed set of languages through shiki's core and its JavaScript engine, built here rather
 * than through `@aparte/plugin-shiki`'s main entry: that one maps every language shiki knows
 * to a file of its own (302 of them). A language outside the set reads as plain text. The
 * colors follow the widget's scheme, light or dark.
 */
import { AparteConfig } from '@aparte/core';
import { setupShikiProviderFromHighlighter } from '@aparte/plugin-shiki/core';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import html from '@shikijs/langs/html';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import python from '@shikijs/langs/python';
import sql from '@shikijs/langs/sql';
import typescript from '@shikijs/langs/typescript';
import yaml from '@shikijs/langs/yaml';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';

/** Highlight `code` as `lang`: shiki's HTML, or the code as plain text in a language it lacks. */
export async function createHighlighter(): Promise<(code: string, lang: string) => Promise<string>> {
    const highlighter = await createHighlighterCore({
        themes: [githubLight, githubDark],
        langs: [bash, css, html, javascript, json, python, sql, typescript, yaml],
        engine: createJavaScriptRegexEngine(),
    });
    // The plugin's provider (its plain-text fallback, its light/dark pair) on a config of its
    // own, called from the widget's: the widget's config keeps one provider, this lazy one.
    const own = new AparteConfig();
    setupShikiProviderFromHighlighter(highlighter, { theme: { light: 'github-light', dark: 'github-dark' } }, own);
    return (code, lang) => own.highlightCode(code, lang);
}
