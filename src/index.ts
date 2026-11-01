/**
 * @aparte/n8n-chat — n8n's chat widget, drawn by aparté.
 *
 * `createChat()` takes `@n8n/chat`'s options and mounts the same widget — a button in the
 * corner, or a chat that fills its target — on an n8n Chat Trigger, through
 * `@aparte/runner-n8n`. `style.css` is aparté's stylesheet with the n8n theme;
 * `theme.css` is the theme alone, for a chat you compose yourself.
 */
export { createChat } from './create-chat.js';
export type { Chat, ChatOptions, ChatResponse } from './create-chat.js';
export type { CardOptions } from './cards.js';
export type { ChatStrings } from './strings.js';
// The card kit, from this module: a page that loads the widget from a CDN takes `defineCard`
// here, so its own card and the chat share one aparté. Loaded from a second URL, the kit would
// keep its cards in a registry the chat never reads.
export { defineCard, el, glyph, safeUrl, webUrl, formatNumber, formatPrice, formatDay, formatWhen } from '@aparte/plugin-cards';
export type { CardDefinition, CardContext, AparteCardSegment } from '@aparte/plugin-cards';
