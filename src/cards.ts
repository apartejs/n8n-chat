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
import type { PlaceCardOptions } from '@aparte/plugin-cards/place';

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

/**
 * A card's own options, handed to its setup when it loads, so passing them fetches nothing
 * early. What is about where a card's data comes from (`tool`, `map`) is not here: the
 * widget's blocks are that.
 */
export type CardOptions = {
    place?: Pick<PlaceCardOptions, 'mapTiles' | 'mapAttribution' | 'mapZoom' | 'currencySymbol' | 'builtIns'>;
} & Partial<Record<Exclude<keyof typeof CARDS, 'place'>, Record<string, unknown>>>;

/** `place` → `setupPlaceCard`, the setup each card's entry exports. */
const setupName = (card: string) => `setup${card.charAt(0).toUpperCase()}${card.slice(1)}Card`;

/** Draw the card blocks in this widget's answers. Returns the function that stops it. */
export function setupCards(config: AparteConfig, options: CardOptions = {}): () => void {
    const load = Object.fromEntries(Object.entries(CARDS).map(([name, fetch]) => {
        const own = options[name as keyof CardOptions];
        if (!own) return [name, fetch];
        // The card's setup, its options under what the fence passes (the config).
        return [name, () => fetch().then((module: Record<string, unknown>) => {
            const setup = module[setupName(name)];
            return typeof setup === 'function'
                ? { ...module, [setupName(name)]: (o: Record<string, unknown>) => (setup as (x: Record<string, unknown>) => unknown)({ ...own, ...o }) }
                : module;
        })];
    }));
    return setupCardFences({ config, load });
}
