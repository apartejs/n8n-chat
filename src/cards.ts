/**
 * Rich cards in a workflow's answer: a ```card-weather code block of JSON in the text an n8n
 * workflow returns is drawn as `@aparte/plugin-cards`' weather card. The recognition is the
 * plugin's (`setupCardFences`); this file only says where each card's code comes from, so each
 * is its own chunk, fetched the first time a block names it.
 *
 *   The weather in Lille:
 *   ```card-weather
 *   {"location":"Lille","temperature":11,"condition":"rain"}
 *   ```
 */
import { setupCardFences } from '@aparte/plugin-cards';
import type { AparteConfig } from '@aparte/core';

/** Each card, and how to fetch it: one chunk per card in the CDN build too. */
const CARDS = {
    weather: () => import('@aparte/plugin-cards/weather'),
    items: () => import('@aparte/plugin-cards/items'),
    product: () => import('@aparte/plugin-cards/product'),
    place: () => import('@aparte/plugin-cards/place'),
    stats: () => import('@aparte/plugin-cards/stats'),
    order: () => import('@aparte/plugin-cards/order'),
    stock: () => import('@aparte/plugin-cards/stock'),
    plan: () => import('@aparte/plugin-cards/plan'),
    score: () => import('@aparte/plugin-cards/score'),
    media: () => import('@aparte/plugin-cards/media'),
    link: () => import('@aparte/plugin-cards/link'),
};

/** Draw the card blocks in this widget's answers. Returns the function that stops it. */
export const setupCards = (config: AparteConfig): (() => void) => setupCardFences({ config, load: CARDS });
