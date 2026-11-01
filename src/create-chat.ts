/**
 * createChat — n8n's chat widget, drawn by aparté, from the same call.
 *
 * The options are `@n8n/chat`'s, under its names and with its defaults, so a page swaps
 * the import and keeps its call: the same webhook, the same session key in the browser
 * (a visitor keeps their conversation across the switch), the same `--chat--*` variables
 * read by the n8n theme. What it adds is what the original lacks: a handle to open, close,
 * send and reset; a real new conversation; French; history without the tool steps; errors
 * that say what to change in n8n; and no style leaking into the page.
 */
import { AparteClient, AparteConfig, AparteError, AparteErrorCode, attachConfig, registerSegmentRenderer, uuid } from '@aparte/core';
import type { AparteLauncher, AparteLocale, AparteMessage, AparteSegment, AparteStreamRunner } from '@aparte/core';
import { setupMarkedStreamingProvider } from '@aparte/plugin-marked/streaming';
import { createN8nRunner, loadN8nHistory, setupN8nButtons } from '@aparte/runner-n8n';
import { setupCards } from './cards.js';
import { N8N_ICONS } from './icons.js';
import { initialMessagesFor, loadLocale, stringsFor } from './strings.js';
import type { ChatStrings } from './strings.js';

/**
 * The webhook as an absolute URL: the n8n protocol builds its socket's address from it, and a
 * relative one failed there with "Invalid URL" at the first button. Read against the page, as
 * a link is; a URL that still is not one is said at once, by name.
 */
function absoluteUrl(url: string): string {
    // Missing or empty would read as the page itself — a silent 404 on every message.
    if (typeof url !== 'string' || !url.trim()) {
        throw new TypeError("[aparte] n8n: createChat needs webhookUrl, the Chat Trigger's production URL, the one that ends in /chat.");
    }
    try {
        return new URL(url, typeof document === 'undefined' ? undefined : document.baseURI).href;
    } catch {
        throw new TypeError(`[aparte] n8n: webhookUrl "${url}" is not a URL. Use the Chat Trigger's production URL, the one that ends in /chat.`);
    }
}

/** `createChat`'s options: `@n8n/chat`'s, under its names and with its defaults. */
export interface ChatOptions {
    /**
     * The Chat Trigger's production URL, the one that ends in `/chat`. A relative URL is read
     * against the page's address, as a link would be.
     */
    webhookUrl: string;
    /**
     * `headers` are sent with every request, read each time — so an object you change later
     * (a refreshed token) is honoured. `method` is accepted for compatibility: every request
     * is a POST, which is what n8n answers for streaming and files.
     */
    webhookConfig?: { method?: 'GET' | 'POST'; headers?: Record<string, string> };
    /**
     * Where the widget mounts: an element, or a selector. A selector that matches nothing
     * gets a `div` with that id (or class) at the end of the body.
     * @default '#n8n-chat'
     */
    target?: string | Element;
    /**
     * `'window'` floats a button in the corner that opens the chat; `'embedded'` sits in the
     * page as a block, filling the target, which needs a height. `'fullscreen'` is the same
     * as `'embedded'`: the name `@n8n/chat` gives it, kept so its setup carries over.
     * @default 'window'
     */
    mode?: 'window' | 'embedded' | 'fullscreen';
    /**
     * A ✕ in the header, in window mode. Without it the button in the corner closes the
     * chat, and on a phone, where the open chat covers the page, it moves to the top corner.
     * @default false, as n8n's widget
     */
    showWindowCloseButton?: boolean;
    /** Show a screen with a "New Conversation" button before the chat. @default false */
    showWelcomeScreen?: boolean;
    /**
     * Keep the session in the browser (`localStorage`, key `n8n-chat/sessionId`, the one
     * n8n's widget uses) and show its earlier messages again on load. Needs the Chat
     * Trigger's *Load Previous Session* set to *From Memory*, its memory connected to the
     * trigger too. Off: each page load is a new conversation.
     * @default true
     */
    loadPreviousSession?: boolean;
    /** Use this session instead of the stored one (your app's conversation id). */
    sessionId?: string;
    /** @default 'chatInput', the Chat Trigger's */
    chatInputKey?: string;
    /** @default 'sessionId', the Chat Trigger's */
    chatSessionKey?: string;
    /**
     * The language, as a tag (`'de'`, `'pt-BR'`, `'fr-CA'`): the chrome's words come from
     * `i18n[defaultLanguage]` over the built-in ones, the chat's own from aparté's locale,
     * loaded for that language alone. Ten ship, all left to right: English, French, Spanish,
     * Portuguese (Brazil), German, Italian, Russian, Japanese, Korean and Chinese
     * (Simplified); another tag reads in English, or in the `locale` you give.
     * @default 'en'
     */
    defaultLanguage?: string;
    /** Messages shown first, from the assistant; neither sent nor kept. @default n8n's two */
    initialMessages?: string[];
    /**
     * A conversation to show when n8n has none for the session — after the first messages,
     * as n8n's widget shows it. Shown, not sent: n8n's memory does not hold it.
     */
    messageHistory?: ChatHistoryMessage[];
    /** Sent with every message, as `metadata` in the trigger's output. */
    metadata?: Record<string, unknown>;
    /** The chrome's words, by language, over the built-in ones. */
    i18n?: Record<string, Partial<ChatStrings>>;
    /**
     * The chat's own words — its buttons, its error card, its screen-reader names — for a
     * language aparté does not ship: an `AparteLocale` (see the localization guide).
     * @default English, or French for `defaultLanguage: 'fr'`
     */
    locale?: AparteLocale;
    /** Let the person attach files; n8n receives them as `files`. @default false */
    allowFileUploads?: boolean | { value: boolean };
    /** What the file picker offers, as an `accept` list (`'image/*,.pdf'`). @default any */
    allowedFilesMimeTypes?: string | { value: string };
    /** Accepted for compatibility: a streamed answer and a whole one are both read. */
    enableStreaming?: boolean;
    /** Called with the message before it is sent, and awaited. */
    beforeMessageSent?: (message: string) => void | Promise<void>;
    /**
     * Called with the message and the answer once the answer is complete, after the turn —
     * a hook that throws or takes its time changes nothing on screen. The answer reads like
     * either of n8n's: `output` (a whole answer), `message` and `hasReceivedChunks` (a
     * streamed one).
     */
    afterMessageSent?: (message: string, response?: ChatResponse) => void | Promise<void>;
    /** Accepted for compatibility: n8n's widget never read it. Theme with CSS variables. */
    theme?: unknown;
    /**
     * Questions offered above the input until the first message, one press to send.
     * @default none
     */
    suggestions?: string[];
    /**
     * The color scheme: light like n8n's widget, dark, or the visitor's own.
     * @default 'light'
     */
    colorScheme?: 'light' | 'dark' | 'auto';
    /** Every request to n8n goes through it: a proxy, a test, a recorded demo. @default the global `fetch` */
    fetch?: typeof fetch;
    /**
     * Block the input, as n8n's `disabled`: `true`, or n8n's `{ value }` (a Vue ref), read once
     * when the widget mounts. `setDisabled()` on the handle changes it later.
     * @default false
     */
    disabled?: boolean | { value: boolean };
    /**
     * Two actions on the person's own messages, as n8n's widget has them: send the message
     * again, with its files, and put its text back in the input.
     * @default false
     */
    enableMessageActions?: boolean;
    /**
     * What draws a `messageHistory` entry of `type: 'component'`: the function under its `key`
     * gets its `arguments` and returns an element or HTML. n8n's widget takes Vue components
     * here; this one takes functions, which any framework can call into.
     */
    messageComponents?: Record<string, (args: Record<string, unknown>) => HTMLElement | string>;
    /**
     * Draw a ```card-<name> code block of JSON in an answer as that rich card (`true` by
     * default): weather, items, product, place, stats, order, stock, plan, score, media,
     * link. Each card's code is fetched the first time it appears. `false` shows the block as
     * code, as n8n's own widget does.
     */
    cards?: boolean;
    /**
     * Extend the chat with aparté's plugins and your own cards: called once with the widget's
     * config, before the first message. What it returns, if a function, runs on `destroy()`.
     *
     * @example
     * import { setupKatex } from '@aparte/plugin-katex';
     * createChat({ webhookUrl, setup: (config) => setupKatex({}, config) });
     */
    setup?: (config: AparteConfig) => void | (() => void);
}

/** A `messageHistory` entry: text, or a component drawn by `messageComponents`. */
export type ChatHistoryMessage =
    | { type?: 'text'; text: string; sender: 'user' | 'bot'; transparent?: boolean }
    | { type: 'component'; key: string; arguments?: Record<string, unknown>; sender: 'user' | 'bot'; transparent?: boolean };

/** The answer `afterMessageSent` receives, shaped like both of `@n8n/chat`'s. */
export interface ChatResponse {
    /** The answer's text, as a whole answer's `output`. */
    output: string;
    /** The answer's text, as a streamed answer's `message`. */
    message: string;
    /** Whether any text arrived. */
    hasReceivedChunks: boolean;
}

/** What `createChat` returns: the widget, and what a page can do with it. */
export interface Chat {
    /** The widget's root element: `<aparte-launcher>` in window mode, a `div` when embedded. */
    readonly element: HTMLElement;
    /** The session the conversation runs in. */
    readonly sessionId: string;
    /** Open the chat (window mode). */
    open(): void;
    /** Close the chat (window mode). */
    close(): void;
    /** Open it when closed, close it when open (window mode). */
    toggle(): void;
    /**
     * Send a message as the person. While an answer is on its way, it waits for it; what
     * the person is typing is left as it is.
     */
    send(text: string): void;
    /**
     * Start a new conversation: the answer on its way stops, the first messages come back,
     * and a new session starts — unless you gave `sessionId`, which is yours to change.
     */
    reset(): void;
    /** Block the input, or let the person type again. */
    setDisabled(disabled: boolean): void;
    /** Remove the widget and stop its client. */
    destroy(): void;
    /** The same as `destroy()`, under the name of the Vue app n8n's widget returns. */
    unmount(): void;
}

const STORAGE_KEY = 'n8n-chat/sessionId';

type Viewport = HTMLElement & { setMessages(messages: AparteMessage[]): void };
type ChatElement = HTMLElement & { viewport: Viewport | null };
type Composer = HTMLElement & { setValue(value: string): void; submit(): void; cancel(): void; readonly streaming: boolean; readonly value: string };

/** An error the workflow itself reported in its answer: its words are the visitor's to read. */
const WORKFLOW_ERROR = 'N8N_WORKFLOW_ERROR' as AparteErrorCode;

/** A `messageHistory` component, carried as a segment so the bubble draws it in its place. */
interface ComponentSegment { id: string; type: 'n8n-component'; key: string; arguments: Record<string, unknown> }

/** The `messageComponents` of each widget, by its chat: the renderer is one for the page. */
const componentsByChat = new WeakMap<Element, NonNullable<ChatOptions['messageComponents']>>();

let componentRendererRegistered = false;
function registerComponentRenderer(): void {
    if (componentRendererRegistered) return;
    componentRendererRegistered = true;
    registerSegmentRenderer({
        type: 'n8n-component',
        render: (segment) => {
            const { key, arguments: args } = segment as unknown as ComponentSegment;
            // The renderer runs for the bubble before it is in place, so the chat is found
            // when its element is: an empty holder now, filled once connected.
            const holder = document.createElement('div');
            holder.className = 'aparte-segment aparte-n8n__component';
            holder.setAttribute('data-component', key);
            queueMicrotask(() => {
                const chat = holder.closest('aparte-chat');
                const draw = chat ? componentsByChat.get(chat)?.[key] : undefined;
                if (!draw) { console.warn(`[aparte] n8n: no messageComponents entry for "${key}".`); return; }
                const out = draw(args);
                if (typeof out === 'string') holder.innerHTML = out;
                else holder.replaceChildren(out);
            });
            return holder;
        },
    });
}

function read(key: string): string | undefined {
    try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; }
}

function write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* storage blocked: the session lasts the page */ }
}

/** The mount point: the element, the selector's match, or a new one named after the selector. */
function resolveTarget(target: string | Element): Element {
    if (typeof target !== 'string') return target;
    const found = document.querySelector(target);
    if (found) return found;
    const el = document.createElement('div');
    if (target.startsWith('#')) el.id = target.slice(1);
    else if (target.startsWith('.')) el.className = target.slice(1);
    document.body.appendChild(el);
    return el;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K];
function el(tag: string, className?: string, text?: string): HTMLElement;
function el(tag: string, className?: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

let instances = 0;

/**
 * Mount n8n's chat widget, drawn by aparté: the same options as `@n8n/chat`'s
 * `createChat`, and a handle to drive it.
 *
 * @example
 * import { createChat } from '@aparte/n8n-chat';
 * import '@aparte/n8n-chat/style.css';
 *
 * createChat({ webhookUrl: 'https://your-n8n.example.com/webhook/<id>/chat' });
 */
export function createChat(options: ChatOptions): Chat {
    const webhookUrl = absoluteUrl(options.webhookUrl);
    const mode = options.mode ?? 'window';
    const language = options.defaultLanguage ?? 'en';
    const strings = stringsFor(language, options.i18n);
    const loadPrevious = options.loadPreviousSession ?? true;
    const initial = options.initialMessages ?? initialMessagesFor(language);
    const instance = ++instances;
    const titleId = `aparte-n8n-title-${instance}`;

    // A visitor who comes back to a conversation: n8n's widget skips its welcome screen for them.
    const returning = loadPrevious && !options.sessionId && Boolean(read(STORAGE_KEY));
    let sessionId = options.sessionId ?? (loadPrevious ? read(STORAGE_KEY) : undefined) ?? uuid();
    if (loadPrevious && !options.sessionId) write(STORAGE_KEY, sessionId);

    // ── The config: this widget's own, so nothing on the page's other chats changes ───────
    const config = new AparteConfig();
    // The chat's own words: the page's locale, else the language's, loaded now — a page that
    // speaks German downloads German alone. Until it lands, core's English; then the chat
    // switches, as it does on any locale change.
    if (options.locale) config.setLocale(options.locale);
    let destroyed = false;
    // The locale as it stands before the page's `setup`: if `setup` sets its own, the language
    // loaded afterwards must not replace it.
    let beforeSetup = config.getLocale();
    void loadLocale(language)?.then((locale) => {
        if (!destroyed && !options.locale && config.getLocale() === beforeSetup) config.setLocale(locale);
    }, (error: unknown) => console.warn("[aparte] n8n: the chat's language could not be loaded; it stays in English.", error));
    // n8n's look in the icons too: a filled bubble on the button, a chevron once open.
    config.registerIcons(N8N_ICONS);
    // A help chat is read, not quoted: no copy button under the answers (core's default since
    // 0.27.1). A tool call, should one be drawn, is core's quiet line already.
    if (options.enableMessageActions) {
        config.registerAction({ id: 'n8n-repost', icon: 'retry', label: strings.repostButton, zones: ['bubble'], bubble: { roles: ['user'] } });
        config.registerAction({ id: 'n8n-reuse', icon: 'edit', label: strings.reuseButton, zones: ['bubble'], bubble: { roles: ['user'] } });
    }
    // What the person sent opens in a new tab, a picture or a file, as in n8n's widget.
    config.setHostHandlers({ attachmentPreview: true, filePreview: true });
    // A Chat node's buttons (a workflow with response nodes) are asked at the composer, with
    // their labels; n8n's Block User Input leaves no field to write in instead.
    setupN8nButtons(config);
    // A card the workflow writes into its answer: drawn, its code fetched the first time.
    const stopCards = options.cards === false ? undefined : setupCards(config);
    // An error is core's card: a sentence in the visitor's language, chosen by its code, and
    // the message (what to change in n8n) on the console for the page's developer. One that
    // the workflow itself reported keeps its words too, under the sentence: they say what
    // went wrong ("this model does not take images"), which n8n's widget shows as well.
    config.setErrorRenderer(({ message, sentence, code }) => {
        const workflow = code === WORKFLOW_ERROR;
        const card = el('div', 'aparte-segment aparte-alert aparte-alert--danger aparte-segment-error');
        if (code) card.setAttribute('data-error-code', workflow ? AparteErrorCode.PROVIDER_ERROR : code);
        const icon = el('span', 'aparte-alert__icon');
        icon.innerHTML = config.getIcon('error') || '⚠';
        const body = el('div', 'aparte-alert__body');
        body.append(
            el('div', 'aparte-alert__title', config.t('error')),
            el('div', 'aparte-alert__message', workflow ? config.t('errorNoAnswer') : sentence ?? message),
        );
        if (workflow && message) body.append(el('p', 'aparte-n8n__error-detail', message));
        card.append(icon, body);
        return card;
    });
    setupMarkedStreamingProvider(undefined, config);
    // Code in an answer, highlighted as in n8n's widget — its grammars fetched the first time
    // an answer holds code, so a widget that never shows code never downloads them.
    let highlighter: Promise<(code: string, lang: string) => Promise<string>> | undefined;
    config.setHighlightProvider(async (code, lang) => {
        highlighter ??= import('./highlight.js').then((m) => m.createHighlighter());
        return (await highlighter)(code, lang);
    });
    // The page's own, last: aparté's plugins, its own cards, and its own Markdown or highlight
    // provider over the widget's — on this chat's config alone.
    beforeSetup = config.getLocale();
    const stopSetup = options.setup?.(config);

    // ── The markup ─────────────────────────────────────────────────────────────────────
    const card = el('section', 'aparte-n8n__window');
    card.setAttribute('aria-labelledby', titleId);

    const header = el('header', 'aparte-n8n__header');
    const heading = el('div', 'aparte-n8n__heading');
    const title = el('p', 'aparte-n8n__title', strings.title);
    title.id = titleId;
    heading.append(title);
    if (strings.subtitle) heading.append(el('p', 'aparte-n8n__subtitle', strings.subtitle));
    header.append(heading);
    if (mode === 'window' && options.showWindowCloseButton) {
        const close = el('button', 'aparte-btn aparte-btn--icon aparte-btn--ghost aparte-n8n__close');
        close.type = 'button';
        close.setAttribute('aria-label', strings.closeButtonTooltip);
        close.setAttribute('data-aparte-launcher-close', '');
        const icon = el('aparte-icon');
        icon.setAttribute('name', 'close');
        close.append(icon);
        header.append(close);
    }

    const chat = el('aparte-chat', 'aparte-n8n__chat') as ChatElement;
    // Named, so its composer and its client answer this chat alone on a page that has others.
    chat.id = `aparte-n8n-chat-${instance}`;
    if (options.messageComponents) {
        registerComponentRenderer();
        componentsByChat.set(chat, options.messageComponents);
    }
    const composer = el('aparte-composer') as Composer;
    composer.setAttribute('placeholder', strings.inputPlaceholder);
    let suggestions: HTMLElement | undefined;
    if (options.suggestions?.length) {
        suggestions = el('aparte-suggestions');
        suggestions.setAttribute('suggestions', JSON.stringify(options.suggestions.map((text) => ({ label: text, prompt: text }))));
        composer.append(suggestions);
    }
    const shell = el('div', 'aparte-composer-shell');
    const row = el('div', 'aparte-composer-row');
    row.append(el('aparte-composer-input'));
    // n8n's widget takes these as plain values or as Vue refs (`{ value }`); so does this one.
    const allowFiles = typeof options.allowFileUploads === 'object' ? options.allowFileUploads?.value : options.allowFileUploads;
    const acceptFiles = typeof options.allowedFilesMimeTypes === 'object' ? options.allowedFilesMimeTypes?.value : options.allowedFilesMimeTypes;
    if (allowFiles) {
        shell.append(el('aparte-composer-attachments'));
        const add = el('aparte-composer-add-attachment');
        if (acceptFiles) add.setAttribute('accept', acceptFiles);
        // After the input, beside send: where n8n's widget puts its paperclip.
        row.append(add);
    }
    row.append(el('aparte-composer-send'));
    shell.append(row);
    composer.append(shell);
    // The presenter a chat's default composition carries, written here since the widget
    // composes its own: without it, a Chat node's buttons had nobody to ask them.
    chat.append(el('aparte-chat-viewport'), el('aparte-elicitation'), composer);

    card.append(header, chat);
    if (strings.footer) card.append(el('p', 'aparte-n8n__footer', strings.footer));

    let welcome: HTMLElement | undefined;
    if (options.showWelcomeScreen && !returning) {
        welcome = el('div', 'aparte-n8n__welcome');
        const start = el('button', 'aparte-btn aparte-btn--primary aparte-btn--solid aparte-n8n__start', strings.getStarted);
        start.type = 'button';
        start.addEventListener('click', () => {
            welcome!.hidden = true;
            chat.hidden = false;
            chat.querySelector<HTMLElement & { focusEnd?: () => void }>('aparte-composer-input')?.focusEnd?.();
        });
        welcome.append(start);
        chat.hidden = true;
        card.insertBefore(welcome, chat);
    }

    let root: HTMLElement;
    if (mode === 'window') {
        root = el('aparte-launcher', 'aparte-n8n aparte-n8n--window');
        root.append(card);
    } else {
        root = el('div', 'aparte-n8n aparte-n8n--fullscreen');
        root.append(card);
    }
    const scheme = options.colorScheme ?? 'light';
    if (scheme !== 'auto') root.setAttribute('data-aparte-theme', scheme);
    // Its own language, so a screen reader reads a French widget on an English page in French.
    root.setAttribute('lang', language);
    if (mode === 'window') {
        // On a phone the open chat covers the page: a modal dialog to assistive technology too,
        // not only to Tab.
        root.addEventListener('aparte-launcher-toggle', (event) => {
            const { open, sheet } = (event as CustomEvent<{ open: boolean; sheet: boolean }>).detail;
            if (open && sheet) {
                card.setAttribute('role', 'dialog');
                card.setAttribute('aria-modal', 'true');
            } else {
                card.removeAttribute('role');
                card.removeAttribute('aria-modal');
            }
        });
    }
    attachConfig(root, config);
    resolveTarget(options.target ?? '#n8n-chat').append(root);

    // ── The conversation ───────────────────────────────────────────────────────────────
    const firstMessages = (): AparteMessage[] => initial.map((content, i) => ({
        id: `n8n-initial-${i}`, role: 'assistant', content, timestamp: Date.now() - initial.length + i, status: 'completed',
    }));
    const seeded = (): AparteMessage[] => (options.messageHistory ?? []).map((m, i) => {
        const base = { id: `n8n-seed-${i}`, role: m.sender === 'user' ? 'user' : 'assistant', timestamp: Date.now(), status: 'completed' } as const;
        if (m.type === 'component') {
            const segment: ComponentSegment = { id: `n8n-seed-${i}-component`, type: 'n8n-component', key: m.key, arguments: m.arguments ?? {} };
            return { ...base, content: '', segments: [segment as unknown as AparteSegment] };
        }
        return { ...base, content: m.text };
    });
    // n8n's `transparent`: a history message drawn without its bubble.
    const transparent = new Set((options.messageHistory ?? []).flatMap((m, i) => (m.transparent ? [`n8n-seed-${i}`] : [])));
    // The viewport draws its bubbles in its own time, so they are marked as they arrive.
    if (transparent.size) {
        new MutationObserver(() => {
            for (const id of transparent) {
                const bubble = chat.querySelector(`aparte-chat-bubble[message-id="${id}"]`);
                if (bubble && !bubble.hasAttribute('data-n8n-transparent')) bubble.setAttribute('data-n8n-transparent', '');
            }
        }).observe(chat, { childList: true, subtree: true });
    }
    const show = (messages: AparteMessage[]) => chat.viewport?.setMessages(messages);
    show([...firstMessages(), ...seeded()]);
    if (options.messageHistory?.length && suggestions) suggestions.hidden = true;

    let loaded = 0;
    let historyRequest: AbortController | undefined;
    const loadHistory = () => {
        const ticket = ++loaded;
        historyRequest = new AbortController();
        void loadN8nHistory({
            webhookUrl,
            sessionId,
            ...(options.metadata ? { metadata: options.metadata } : {}),
            ...(options.chatSessionKey ? { chatSessionKey: options.chatSessionKey } : {}),
            headers: () => ({ ...(options.webhookConfig?.headers ?? {}) }),
            ...(options.fetch ? { fetch: options.fetch } : {}),
            signal: historyRequest.signal,
        }).then((history) => {
            // A reset or a first message since: that conversation is the one on screen.
            if (ticket !== loaded || history.length === 0) return;
            if (suggestions) suggestions.hidden = true;
            show([...firstMessages(), ...history]);
        }, (error: unknown) => {
            if (historyRequest?.signal.aborted) return;
            console.warn(`[aparte] n8n: ${error instanceof Error ? error.message : String(error)}`);
        });
    };
    // In a window, when the chat first opens, not on every page view: each request reaches the
    // n8n instance — an execution on n8n Cloud — whether or not the visitor ever chats. A full
    // page shows its chat at once, so it asks at once.
    if (loadPrevious) {
        if (mode === 'window') {
            const onFirstOpen = (event: Event) => {
                if (!(event as CustomEvent<{ open: boolean }>).detail.open) return;
                root.removeEventListener('aparte-launcher-toggle', onFirstOpen);
                // A message sent before the first opening has started the conversation already.
                if (loaded === 0) loadHistory();
            };
            root.addEventListener('aparte-launcher-toggle', onFirstOpen);
        } else {
            loadHistory();
        }
    }

    // The person's message and its session, taken when it is sent: a reset while its turn
    // waits on `beforeMessageSent` must not post it into the new conversation.
    let lastSent = '';
    let sentIn = sessionId;
    // Whether a reply is on its way, from the chat's own lifecycle events, so `send()` can
    // wait for it rather than press Stop.
    let busy = false;
    const queued: string[] = [];
    chat.addEventListener('aparte-send', (event) => {
        loaded++;
        lastSent = String((event as CustomEvent<{ content?: unknown }>).detail?.content ?? '');
        sentIn = sessionId;
        if (suggestions) suggestions.hidden = true;
    });
    const dispatchSend = (text: string, files?: File[]) => {
        if (welcome && !welcome.hidden) { welcome.hidden = true; chat.hidden = false; }
        // As the composer sends, without touching what the person is typing.
        chat.dispatchEvent(new CustomEvent('aparte-send', {
            detail: { content: text, timestamp: Date.now(), targetId: chat.id, ...(files?.length ? { files } : {}) },
            bubbles: true,
            composed: true,
        }));
    };
    const settle = () => {
        busy = false;
        const next = queued.shift();
        if (next !== undefined) queueMicrotask(() => dispatchSend(next));
    };
    chat.addEventListener('aparte-message-start', () => { busy = true; });
    for (const type of ['aparte-message-done', 'aparte-message-error', 'aparte-message-aborted']) chat.addEventListener(type, settle);
    // Stop says it on the window, named for this chat.
    const onStopped = (event: Event) => {
        if ((event as CustomEvent<{ targetId?: string }>).detail?.targetId === chat.id) settle();
    };
    window.addEventListener('aparte-message-aborted', onStopped);

    let runSession = sessionId;
    const runner = createN8nRunner({
        webhookUrl,
        sessionId: () => runSession,
        headers: () => ({ ...(options.webhookConfig?.headers ?? {}) }),
        ...(options.fetch ? { fetch: options.fetch } : {}),
        ...(options.metadata ? { metadata: options.metadata } : {}),
        ...(options.chatInputKey ? { chatInputKey: options.chatInputKey } : {}),
        ...(options.chatSessionKey ? { chatSessionKey: options.chatSessionKey } : {}),
    });
    const streamRunner: AparteStreamRunner = async (opts) => {
        const message = lastSent;
        const session = sentIn;
        await options.beforeMessageSent?.(message);
        // Stopped or reset while the hook ran: nothing is sent.
        if (opts.signal.aborted) return undefined;
        runSession = session;
        let reply = '';
        let done = false;
        const result = await runner({
            ...opts,
            emitter: (event) => {
                if (event.type === 'text-delta') reply += event.delta;
                if (event.type === 'run-done') done = true;
                opts.emitter(event);
            },
        }).catch((error: unknown) => {
            // The workflow's own error, sent in its answer (no HTTP status): its words are kept
            // for the visitor under core's sentence. Any other failure is core's to word.
            // Read by its fields, not `instanceof`: a bundle may hold a second copy of core.
            const failure = error as Partial<AparteError> | null;
            if (failure?.code === AparteErrorCode.PROVIDER_ERROR && failure.httpStatus === undefined) {
                throw new AparteError(failure.message ?? '', WORKFLOW_ERROR, failure.data, error);
            }
            throw error;
        });
        // After the turn, not inside it: a slow or failing hook neither holds the Stop
        // button nor turns a finished answer into an error. The second argument reads like
        // either of n8n's: `output` (a whole answer), `message` and `hasReceivedChunks` (a
        // streamed one).
        if (done && options.afterMessageSent) {
            const hook = options.afterMessageSent;
            queueMicrotask(() => {
                Promise.resolve()
                    .then(() => hook(message, { output: reply, message: reply, hasReceivedChunks: reply.length > 0 }))
                    .catch((error: unknown) => console.warn('[aparte] n8n: afterMessageSent threw:', error));
            });
        }
        return result;
    };

    // n8n receives the files as files: none is inlined into the message as well. Scoped to
    // this chat, so a page's own aparté chat is never answered by this widget's workflow.
    const client = new AparteClient({ config, streamRunner, rawFileInject: 'none', scopeToTargetId: chat.id });
    client.start();

    // ── n8n's message actions: send a message again, or take its text back ─────────────────
    type Lookup = Viewport & { getMessage?(id: string): AparteMessage | undefined; getMessages?(): AparteMessage[] };
    const lookup = () => chat.viewport as Lookup | null;
    const onAction = (event: Event) => {
        const { actionId, messageId } = (event as CustomEvent<{ actionId: string; messageId: string }>).detail;
        if (actionId !== 'n8n-repost' && actionId !== 'n8n-reuse') return;
        const message = lookup()?.getMessage?.(messageId);
        if (!message) return;
        if (actionId === 'n8n-reuse') {
            composer.setValue(message.content ?? '');
            chat.querySelector<HTMLElement & { focusEnd?: () => void }>('aparte-composer-input')?.focusEnd?.();
            return;
        }
        // The files as they were sent, read back from the bubble's own copies.
        void Promise.all((message.attachments ?? []).map(async (a) => {
            const blob = await (await fetch(a.url)).blob();
            return new File([blob], a.name, { type: a.type || blob.type });
        })).then((files) => {
            if (busy) queued.push(message.content ?? '');
            else dispatchSend(message.content ?? '', files);
        }, (error: unknown) => console.warn('[aparte] n8n: a file of that message could not be read again:', error));
    };
    chat.addEventListener('aparte-action', onAction);

    // ── A sent message comes back with the arrow keys, as in n8n's widget ──────────────────
    // Up in an empty input brings back the last message sent, and again the one before; Down
    // walks forward, and past the last one gives back what was being typed. While the person
    // types their own text, the keys move the caret as usual.
    let recall = -1;
    let draft = '';
    const input = () => chat.querySelector<HTMLElement & { focusEnd?: () => void }>('aparte-composer-input');
    composer.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
        if (!(event.target as Element | null)?.closest('aparte-composer-input')) return;
        const sent = (lookup()?.getMessages?.() ?? [])
            .filter((m) => m.role === 'user' && m.content?.trim())
            .map((m) => m.content ?? '');
        if (event.key === 'ArrowUp') {
            if ((recall === -1 && composer.value !== '') || recall >= sent.length - 1) return;
            if (recall === -1) draft = composer.value;
            recall++;
        } else {
            if (recall === -1) return;
            recall--;
        }
        event.preventDefault();
        composer.setValue(recall === -1 ? draft : sent[sent.length - 1 - recall] ?? '');
        input()?.focusEnd?.();
    });
    chat.addEventListener('aparte-send', () => { recall = -1; draft = ''; });

    // A link in an answer opens in a new tab, as in n8n's widget: the visitor keeps the page
    // the chat is on. A modified click (a new window, a download) is the browser's.
    chat.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('.aparte-message-content a[href]');
        if (!link || link.getAttribute('href')?.startsWith('#')) return;
        event.preventDefault();
        window.open(link.href, '_blank', 'noopener');
    });

    // A picture or a file opens in a new tab.
    chat.addEventListener('aparte-attachment-preview', (event) => {
        const { url } = (event as CustomEvent<{ url: string }>).detail;
        if (url) window.open(url, '_blank', 'noopener');
    });

    // n8n's `disabled`, a Vue ref there: read once here, changed with `setDisabled()`.
    const setDisabled = (disabled: boolean) => composer.toggleAttribute('disabled', disabled);
    if (typeof options.disabled === 'object' ? options.disabled?.value : options.disabled) setDisabled(true);

    const launcher = () => (mode === 'window' ? (root as AparteLauncher) : undefined);
    const destroy = () => {
        // Once: a second call would run the page's own teardown again.
        if (destroyed) return;
        destroyed = true;
        historyRequest?.abort();
        queued.length = 0;
        window.removeEventListener('aparte-message-aborted', onStopped);
        client.stop();
        stopCards?.();
        if (typeof stopSetup === 'function') stopSetup();
        root.remove();
    };

    return {
        element: root,
        get sessionId() { return sessionId; },
        open: () => launcher()?.show(),
        close: () => launcher()?.close(),
        toggle: () => launcher()?.toggle(),
        send: (text: string) => {
            if (busy) queued.push(text);
            else dispatchSend(text);
        },
        reset: () => {
            // The conversation on screen goes, and so does what was on its way to it — through
            // the composer's own Stop when it shows one, so its button is Send again.
            queued.length = 0;
            if (composer.streaming) composer.cancel();
            client.abort();
            busy = false;
            historyRequest?.abort();
            loaded++;
            sessionId = options.sessionId ?? uuid();
            if (loadPrevious && !options.sessionId) write(STORAGE_KEY, sessionId);
            if (suggestions) suggestions.hidden = false;
            show(firstMessages());
        },
        setDisabled,
        destroy,
        unmount: destroy,
    };
}
