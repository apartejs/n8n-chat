# @aparte/n8n-chat

n8n's chat widget, drawn by [aparté](https://apartejs.dev): `createChat()` takes
[`@n8n/chat`](https://www.npmjs.com/package/@n8n/chat)'s options and mounts the same widget on your
Chat Trigger — a button in the corner, or a chat that fills its target.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aparte/n8n-chat/dist/style.css">
<script type="module">
  import { createChat } from 'https://cdn.jsdelivr.net/npm/@aparte/n8n-chat/+esm';

  createChat({ webhookUrl: 'https://your-n8n.example.com/webhook/<id>/chat' });
</script>
```

With a bundler:

```ts
import { createChat } from '@aparte/n8n-chat';
import '@aparte/n8n-chat/style.css';

const chat = createChat({ webhookUrl: 'https://your-n8n.example.com/webhook/<id>/chat' });
chat.open();
```

It keeps what a page relies on — the option names and defaults, the session in `localStorage`
(`n8n-chat/sessionId`), the history on load, files, n8n's main `--chat--*` variables — and adds a
handle (`open`, `close`, `toggle`, `send`, `reset`, `destroy`), a history without the tool
steps, nine languages loaded one at a time, errors a visitor can read (and a console that says what to change in n8n), readable
contrast, keyboard and screen-reader access, and a dark scheme. It takes n8n's `disabled`,
`enableMessageActions` (Repost and Reuse on the person's messages), `messageComponents` (functions
here, not Vue components), `transparent` history messages and the arrow keys that bring a sent
message back. Code in an answer is highlighted (its grammars load with the first code block) and
links open in a new tab, as in n8n's widget. A workflow that answers through response nodes works
too — its Chat nodes' messages and buttons, Block User Input included — on a Chat Trigger in Hosted
Chat mode, the only one n8n 2.x runs them on. CSS written for n8n's `.chat-*` classes does not carry
over: theme with the `--chat--*` variables.

`@aparte/n8n-chat/theme.css` is the n8n theme alone: put a chat you compose with
`@aparte/runner-n8n` and the React, Vue, Svelte or Angular components inside `.aparte-n8n`.

Docs: https://apartejs.dev/integrations/n8n-chat/

MIT.
