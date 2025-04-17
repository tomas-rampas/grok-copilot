// File: src/extension.ts
import * as vscode from "vscode";
import axios from "axios";

interface GrokResponse {
  choices: { text?: string; message?: { content?: string } }[];
}

// Global variable to store chat history
let chatHistory: { role: string; content: string }[] = [];
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Create an output channel for logging
  outputChannel = vscode.window.createOutputChannel("Grok Copilot");
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine("Activating Grok Copilot extension...");

  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection("grokCopilot");
  context.subscriptions.push(diagnosticCollection);

  // Manual suggestion command
  context.subscriptions.push(
    vscode.commands.registerCommand("grok-copilot.suggest", async () => {
      await suggestCode(diagnosticCollection);
    }),
  );

  // Chat command to focus the sidebar view
  context.subscriptions.push(
    vscode.commands.registerCommand("grok-copilot.chat", async () => {
      outputChannel.appendLine(
        "Executing grok-copilot.chat command to focus sidebar view",
      );
      try {
        await vscode.commands.executeCommand(
          "workbench.view.extension.grokCopilot",
        );
        await vscode.commands.executeCommand("grokChat.focus");
        outputChannel.appendLine("Successfully focused Grok Chat sidebar view");
      } catch (error) {
        outputChannel.appendLine(
          `Error focusing Grok Chat sidebar view: ${error}`,
        );
        vscode.window.showErrorMessage(
          "Failed to open Grok Chat in sidebar. Check Output for details.",
        );
      }
    }),
  );

  // Register the WebviewViewProvider for the sidebar
  const chatProvider = new GrokChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("grokChat", chatProvider),
  );
  outputChannel.appendLine(
    "Registered GrokChatViewProvider for sidebar view with ID grokChat",
  );

  // Inline completions provider
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { scheme: "file", language: "*" }, // All files
      {
        async provideInlineCompletionItems(document, position) {
          const prefix = document.getText(
            new vscode.Range(new vscode.Position(0, 0), position),
          );
          try {
            const apiKey = vscode.workspace
              .getConfiguration("grok-copilot")
              .get("apiKey") as string;
            if (!apiKey) return [];

            const response = await axios.post<GrokResponse>(
              "https://api.x.ai/v1/chat/completions",
              {
                messages: [
                  {
                    role: "user",
                    content: `Complete the following code:\n${prefix}`,
                  },
                ],
                model: "grok-2",
                max_tokens: 100,
              },
              { headers: { Authorization: `Bearer ${apiKey}` } },
            );

            const suggestion =
              response.data.choices[0]?.message?.content?.trim();
            if (!suggestion) return [];

            return [
              {
                insertText: suggestion,
                range: new vscode.Range(position, position),
              },
            ];
          } catch (error) {
            outputChannel.appendLine(`Inline completion error: ${error}`);
            return [];
          }
        },
      },
    ),
  );

  // Suggestions on typing (optional fallback)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async () => {
      await suggestCode(diagnosticCollection, true);
    }),
  );
}

async function suggestCode(
  diagnosticCollection: vscode.DiagnosticCollection,
  inline: boolean = false,
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    if (!inline) {
      vscode.window.showInformationMessage("No active editor.");
    }
    return;
  }

  const document = editor.document;
  const position = editor.selection.active;
  const prefix = document.getText(
    new vscode.Range(new vscode.Position(0, 0), position),
  );

  try {
    const apiKey = vscode.workspace
      .getConfiguration("grok-copilot")
      .get("apiKey") as string;
    if (!apiKey) {
      vscode.window.showErrorMessage(
        "Please set your xAI API key in settings.",
      );
      return;
    }

    const response = await axios.post<GrokResponse>(
      "https://api.x.ai/v1/chat/completions",
      {
        messages: [
          { role: "user", content: `Complete the following code:\n${prefix}` },
        ],
        model: "grok-2",
        max_tokens: 100,
      },
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    const suggestion = response.data.choices[0]?.message?.content?.trim() || "";
    if (!suggestion) {
      if (!inline) {
        vscode.window.showInformationMessage("No suggestion from Grok.");
      }
      return;
    }

    if (inline) {
      const decoration = vscode.window.createTextEditorDecorationType({
        after: { contentText: suggestion, color: "#999999" },
      });
      editor.setDecorations(decoration, [new vscode.Range(position, position)]);
      setTimeout(() => decoration.dispose(), 5000);
    } else {
      editor.edit((editBuilder) => {
        editBuilder.insert(position, suggestion);
      });
    }

    diagnosticCollection.clear();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    diagnosticCollection.set(document.uri, [
      new vscode.Diagnostic(
        new vscode.Range(position, position),
        `Grok API error: ${message}`,
        vscode.DiagnosticSeverity.Error,
      ),
    ]);
  }
}

// WebviewViewProvider for the sidebar chat
class GrokChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "grokChat";
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    outputChannel.appendLine(
      "Resolving Grok Chat WebviewView in sidebar with ID grokChat",
    );

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      outputChannel.appendLine(
        `Received message from Webview: ${message.command}`,
      );
      if (message.command === "sendMessage") {
        const userMessage = message.text;
        chatHistory.push({ role: "user", content: userMessage });
        this.updateWebview(); // Show user message immediately

        // Get code context from active editor
        const editor = vscode.window.activeTextEditor;
        const codeContext = editor ? editor.document.getText() : "";

        try {
          const apiKey = vscode.workspace
            .getConfiguration("grok-copilot")
            .get("apiKey") as string;
          if (!apiKey) {
            chatHistory.push({
              role: "assistant",
              content: "Error: Please set your xAI API key in settings.",
            });
            this.updateWebview();
            return;
          }

          // Prepare messages with system context, code context, and chat history
          const messages = [
            {
              role: "system",
              content:
                "You are a helpful coding assistant. Answer concisely and accurately.",
            },
            { role: "user", content: `Code context:\n${codeContext}` },
            ...chatHistory,
          ];

          const response = await axios.post<GrokResponse>(
            "https://api.x.ai/v1/chat/completions",
            {
              messages: messages,
              model: "grok-2",
              max_tokens: 500,
            },
            { headers: { Authorization: `Bearer ${apiKey}` } },
          );

          const answer =
            response.data.choices[0]?.message?.content ||
            "No response from Grok.";
          chatHistory.push({ role: "assistant", content: answer });
          this.updateWebview();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          chatHistory.push({
            role: "assistant",
            content: `Error: ${errorMessage}`,
          });
          this.updateWebview();
        }
      }
    });

    // Set initial HTML content
    outputChannel.appendLine("Setting initial Webview content for Grok Chat");
    this.updateWebview();
  }

  private updateWebview() {
    if (!this._view) {
      outputChannel.appendLine("No Webview view available to update");
      return;
    }

    const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src vscode-resource: 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src vscode-resource: 'self' 'unsafe-inline'; img-src vscode-resource: 'self';" />
                <title>Grok Chat</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        margin: 10px;
                        background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
                        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
                    }
                    #chat-container {
                        height: calc(100vh - 100px);
                        display: flex;
                        flex-direction: column;
                    }
                    #chat-messages {
                        flex: 1;
                        overflow-y: auto;
                        border: 1px solid var(--vscode-panel-border);
                        padding: 10px;
                        background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
                        border-radius: 5px;
                        margin-bottom: 10px;
                    }
                    .message {
                        margin: 5px 0;
                        padding: 8px;
                        border-radius: 5px;
                        line-height: 1.5;
                    }
                    .user {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        align-self: flex-start;
                        max-width: 80%;
                    }
                    .assistant {
                        background-color: var(--vscode-sideBarSectionHeader-background, #333333);
                        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
                        align-self: flex-start;
                        max-width: 80%;
                        margin-left: auto;
                    }
                    #chat-input {
                        display: flex;
                        gap: 10px;
                    }
                    #message-input {
                        flex: 1;
                        padding: 5px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 5px;
                        resize: none;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                    }
                    #message-input:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                    }
                    #send-button {
                        padding: 5px 15px;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                    #send-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    #loading {
                        text-align: center;
                        padding: 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <div id="chat-container">
                    <div id="chat-messages">
                        ${
                          chatHistory.length > 0
                            ? chatHistory
                                .map(
                                  (msg) => `
                            <div class="message ${msg.role}">
                                <strong>${msg.role === "user" ? "You" : "Grok"}:</strong> ${msg.content.replace(/\n/g, "<br>")}
                            </div>
                        `,
                                )
                                .join("")
                            : '<div id="loading">Loading Grok Chat... Welcome to Grok Copilot!</div>'
                        }
                    </div>
                    <div id="chat-input">
                        <textarea id="message-input" rows="3" placeholder="Type your message..."></textarea>
                        <button id="send-button">Send</button>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('send-button').addEventListener('click', () => {
                        const input = document.getElementById('message-input');
                        const text = input.value.trim();
                        if (text) {
                            vscode.postMessage({ command: 'sendMessage', text: text });
                            input.value = '';
                        }
                    });
                    document.getElementById('message-input').addEventListener('keypress', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const input = document.getElementById('message-input');
                            const text = input.value.trim();
                            if (text) {
                                vscode.postMessage({ command: 'sendMessage', text: text });
                                input.value = '';
                            }
                        }
                    });
                    // Auto-scroll to the latest message
                    const messagesDiv = document.getElementById('chat-messages');
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                </script>
            </body>
            </html>
        `;

    this._view.webview.html = htmlContent;
    outputChannel.appendLine("Updated Webview HTML content for Grok Chat");
  }
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}
