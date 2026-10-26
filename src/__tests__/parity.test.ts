/**
 * What `@n8n/chat` 1.43.3 does that the widget had to learn: `disabled`, the message actions,
 * `messageComponents`, `transparent`, the arrow keys, and the workflow's own error words.
 *
 * Read from n8n's build, not its README, which leaves most of these out.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AparteMessage } from '@aparte/core';
import { createChat } from '../index.js';
import type { Chat, ChatOptions } from '../index.js';

const URL_ = 'https://n8n.example.com/webhook/abc/chat';
const meta = { metadata: { nodeId: 'agent', nodeName: 'AI Agent', itemIndex: 0, runIndex: 0 } };
const frames = (...list: object[]) => list.map((frame) => JSON.stringify(frame)).join('\n') + '\n';
const stream = (text: string) => frames({ type: 'begin', ...meta }, { type: 'item', content: text, ...meta }, { type: 'end', ...meta });

function n8n(answer: () => Response = () => new Response(stream('We sell bread.'), { status: 200 })) {
    const inputs: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        const body = init.body;
        inputs.push(body instanceof FormData ? body.get('chatInput') : (JSON.parse(String(body)) as { chatInput?: unknown }).chatInput);
        return answer();
    }));
    return { inputs };
}

type Composer = HTMLElement & { value: string; setValue(value: string): void };
const composerOf = (chat: Chat) => chat.element.querySelector('aparte-composer') as Composer;
const messagesOf = (chat: Chat): AparteMessage[] =>
    (chat.element.querySelector('aparte-chat-viewport') as unknown as { getMessages(): AparteMessage[] }).getMessages();
const userBubble = (chat: Chat) => [...chat.element.querySelectorAll('aparte-chat-bubble')]
    .find((b) => b.querySelector('.aparte-message[data-role="user"]')) as HTMLElement | undefined;

const chats: Chat[] = [];
function mount(options: Partial<ChatOptions> = {}): Chat {
    const chat = createChat({ webhookUrl: URL_, loadPreviousSession: false, ...options });
    chats.push(chat);
    return chat;
}

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
});

afterEach(() => {
    for (const chat of chats.splice(0)) chat.destroy();
    vi.unstubAllGlobals();
});

describe('n8n parity: the input', () => {
    it("blocks the input with disabled — true, or n8n's { value } — and setDisabled changes it", () => {
        expect(composerOf(mount({ disabled: true })).hasAttribute('disabled')).toBe(true);
        const fromRef = mount({ disabled: { value: true } });
        expect(composerOf(fromRef).hasAttribute('disabled')).toBe(true);
        fromRef.setDisabled(false);
        expect(composerOf(fromRef).hasAttribute('disabled')).toBe(false);
        expect(composerOf(mount()).hasAttribute('disabled')).toBe(false);
    });

    it('brings back what was sent with Up in an empty input, and what was being typed with Down', () => {
        const chat = mount({ messageHistory: [{ sender: 'user', text: 'First' }, { sender: 'bot', text: 'Ok' }, { sender: 'user', text: 'Second' }] });
        const composer = composerOf(chat);
        const input = chat.element.querySelector('aparte-composer-input')!;
        const press = (key: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        press('ArrowUp');
        expect(composer.value).toBe('Second');
        press('ArrowUp');
        expect(composer.value).toBe('First');
        press('ArrowUp');
        expect(composer.value).toBe('First');
        press('ArrowDown');
        press('ArrowDown');
        expect(composer.value).toBe('');
        // Text of the person's own: the keys are theirs.
        composer.setValue('my words');
        press('ArrowUp');
        expect(composer.value).toBe('my words');
    });
});

describe('n8n parity: the message actions', () => {
    const history: ChatOptions['messageHistory'] = [{ sender: 'user', text: 'Do you deliver?' }, { sender: 'bot', text: 'Yes.' }];

    it('are off by default, as in n8n', async () => {
        const chat = mount({ messageHistory: history });
        await vi.waitFor(() => expect(userBubble(chat)).toBeDefined());
        expect(userBubble(chat)!.querySelector('button[aria-label="Repost message"]')).toBeNull();
    });

    it("put Reuse and Repost on the person's own messages only, in the widget's language", async () => {
        const chat = mount({ messageHistory: history, enableMessageActions: true, defaultLanguage: 'fr' });
        await vi.waitFor(() => expect(userBubble(chat)?.querySelector('button[aria-label="Renvoyer le message"]')).not.toBeNull());
        expect(userBubble(chat)!.querySelector('button[aria-label="Réutiliser le message"]')).not.toBeNull();
        const bot = [...chat.element.querySelectorAll('aparte-chat-bubble')].find((b) => b.getAttribute('message-id') === 'n8n-seed-1')!;
        expect(bot.querySelector('button[aria-label="Renvoyer le message"]')).toBeNull();
    });

    it('Reuse puts the text back in the input; Repost sends it again', async () => {
        const { inputs } = n8n();
        const chat = mount({ messageHistory: history, enableMessageActions: true });
        await vi.waitFor(() => expect(userBubble(chat)?.querySelector('button[aria-label="Reuse message"]')).not.toBeNull());
        userBubble(chat)!.querySelector<HTMLButtonElement>('button[aria-label="Reuse message"]')!.click();
        expect(composerOf(chat).value).toBe('Do you deliver?');
        userBubble(chat)!.querySelector<HTMLButtonElement>('button[aria-label="Repost message"]')!.click();
        await vi.waitFor(() => expect(inputs).toEqual(['Do you deliver?']));
        await vi.waitFor(() => expect(messagesOf(chat).filter((m) => m.role === 'user')).toHaveLength(2));
    });
});

describe('n8n parity: the history', () => {
    it("draws a component message with messageComponents, and a transparent one without its bubble", async () => {
        const chat = mount({
            messageHistory: [
                { sender: 'bot', type: 'component', key: 'hours', arguments: { hours: '7:00 – 19:00' } },
                { sender: 'bot', text: 'A note.', transparent: true },
            ],
            messageComponents: { hours: ({ hours }) => `<strong>Open</strong> ${String(hours)}` },
        });
        await vi.waitFor(() => expect(chat.element.querySelector('.aparte-n8n__component')?.innerHTML).toBe('<strong>Open</strong> 7:00 – 19:00'));
        await vi.waitFor(() => expect(chat.element.querySelector('aparte-chat-bubble[message-id="n8n-seed-1"]')?.hasAttribute('data-n8n-transparent')).toBe(true));
        expect(chat.element.querySelector('aparte-chat-bubble[message-id="n8n-seed-0"]')?.hasAttribute('data-n8n-transparent')).toBe(false);
    });
});

describe('n8n parity: the error', () => {
    it("shows the workflow's own words under the sentence, without telling the visitor to try again", async () => {
        n8n(() => new Response(frames({ type: 'begin', ...meta }, { type: 'error', content: 'This model does not take images.', ...meta }), { status: 200 }));
        const chat = mount();
        chat.send('What is this?');
        await vi.waitFor(() => expect(chat.element.querySelector('.aparte-segment-error')).not.toBeNull());
        const card = chat.element.querySelector('.aparte-segment-error')!;
        expect(card.getAttribute('data-error-code')).toBe('PROVIDER_ERROR');
        expect(card.querySelector('.aparte-alert__message')?.textContent).toBe('The assistant couldn’t answer this request.');
        expect(card.querySelector('.aparte-n8n__error-detail')?.textContent).toBe('This model does not take images.');
    });

    it('keeps the words of any other failure to the console: an HTTP error shows the sentence alone', async () => {
        n8n(() => new Response(JSON.stringify({ message: 'Internal: node "Postgres" failed at 10.0.0.4' }), { status: 500 }));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const chat = mount();
        chat.send('Hello?');
        await vi.waitFor(() => expect(chat.element.querySelector('.aparte-segment-error')).not.toBeNull());
        const card = chat.element.querySelector('.aparte-segment-error')!;
        expect(card.querySelector('.aparte-n8n__error-detail')).toBeNull();
        expect(card.textContent).not.toContain('10.0.0.4');
        warn.mockRestore();
    });
});
