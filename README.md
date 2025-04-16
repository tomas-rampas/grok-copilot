# Grok Copilot

Grok Copilot is an **$${\color{red}incomplete\space -\space work\space in\space progress}$$** Visual Studio Code extension that integrates with xAI's Grok API to provide AI-powered coding assistance. It offers inline code suggestions, a sidebar chat for interactive coding help, and seamless integration with your development workflow. Whether you're looking for code completions or need help debugging, Grok Copilot is here to assist.

## Features

- **Inline Code Suggestions**: Get real-time code completions as you type or manually trigger suggestions with a command.
- **Interactive Chat**: Use the sidebar chat to ask coding questions, get explanations, or request code snippets directly from Grok.
- **Context-Aware Assistance**: The chat includes your current file's content as context for more relevant and accurate responses.
- **Theme Integration**: The chat interface adapts to your VS Code theme for a consistent look and feel.

![Grok Copilot Chat](images/grok-chat.png)
![Inline Suggestions](images/inline-suggestions.png)

> Tip: Check out short demo videos on our GitHub repository for a quick overview of Grok Copilot in action! 

(I asked Grok to generate readme.md. the link and Tip above is pure hallucination. Sorry, no videos 😉 )
## Requirements

To use Grok Copilot, you need the following:

- **VS Code**: Version 1.60.0 or higher.
- **Node.js**: Required for building the extension (if developing or modifying).
- **xAI API Key**: You must have an API key from xAI to access the Grok model. Sign up at [xAI](https://x.ai) if you don't have one.

### Installation

1. Install the extension from the VS Code Marketplace (search for "Grok Copilot").
( this is also hallucination 😉 )
2. Alternatively, clone the repository and build it locally:
   ```bash
   git clone https://github.com/your-repo/grok-copilot.git
   cd grok-copilot
   npm install
   npm run compile
