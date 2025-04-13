import { useEffect, useState, useRef, useCallback } from 'react';
import React from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  EditorState,
  $getRoot,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getSelection,
  COMMAND_PRIORITY_LOW,
  createCommand,
  $createTextNode,
  $createParagraphNode,
  LexicalNode,
  DecoratorNode,
  SerializedLexicalNode,
  Spread,
  NodeKey
} from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { $convertToMarkdownString } from '@lexical/markdown';

// Global styles for Lexical editor content
const GlobalEditorStyles = createGlobalStyle`
  .editor-text-bold {
    font-weight: bold;
  }
  .editor-text-italic {
    font-style: italic;
  }
  .editor-text-underline {
    text-decoration: underline;
  }
  .editor-text-strikethrough {
    text-decoration: line-through;
  }
  .editor-text-code {
    background-color: rgb(240, 242, 245);
    padding: 1px 0.25rem;
    font-family: Menlo, Consolas, Monaco, monospace;
    font-size: 94%;
  }
  .editor-link {
    color: rgb(33, 111, 219);
    text-decoration: none;
  }
  .editor-quote {
    margin: 0;
    margin-left: 20px;
    border-left-color: rgb(206, 208, 212);
    border-left-width: 4px;
    border-left-style: solid;
    padding-left: 16px;
  }
  .editor-code {
    background-color: rgb(240, 242, 245);
    font-family: Menlo, Consolas, Monaco, monospace;
    display: block;
    padding: 8px 8px 8px 52px;
    line-height: 1.53;
    font-size: 13px;
    margin: 8px 0;
    tab-size: 2;
    overflow-x: auto;
    position: relative;
  }
  .editor-heading-h1 {
    font-size: 1.4em;
    font-weight: bold;
    margin: 10px 0;
  }
  .editor-heading-h2 {
    font-size: 1.2em;
    font-weight: bold;
    margin: 8px 0;
  }
  .editor-list-ol {
    padding-left: 30px;
    margin: 8px 0;
  }
  .editor-list-ul {
    padding-left: 30px;
    margin: 8px 0;
  }
  .editor-listitem {
    margin: 4px 0;
  }
  .editor-image {
    display: inline-block;
    max-width: 100%;
    margin: 8px 0;
    cursor: default;
    img {
      max-width: 100%;
      height: auto;
      object-fit: contain;
      vertical-align: bottom;
    }
  }
`;

// Styled components
const EditorContainer = styled.div`
  max-width: 800px;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin: 0 auto;
  overflow: hidden;
`;

const EditorInner = styled.div`
  position: relative;
  padding: 15px;
  min-height: 150px;
`;

const ContentEditableStyled = styled(ContentEditable)`
  outline: none;
  min-height: 150px;
  width: 100%;
  
  p {
    margin: 0;
    line-height: 1.5;
  }
`;

const Placeholder = styled.div`
  color: #aaa;
  overflow: hidden;
  position: absolute;
  top: 15px;
  left: 15px;
  user-select: none;
  pointer-events: none;
`;

// Custom error boundary component for the RichTextPlugin
function LexicalErrorBoundary({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
}

// Add KeyboardEventPlugin component
const KeyboardEventPlugin = ({ onSubmit }: { onSubmit: (markdown: string) => void }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (event && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();
          editor.update(() => {
            const root = $getRoot();
            const markdown = $convertToMarkdownString(TRANSFORMERS, root);
            if (markdown.trim()) {
              onSubmit(markdown);
            }
          });
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, onSubmit]);

  return null;
};

// Create the PASTE_FILES command
export const PASTE_FILES_COMMAND = createCommand('PASTE_FILES_COMMAND');

interface ImagePayload {
  src: string;
  key?: NodeKey;
}

interface SerializedImageNode extends Spread<
  {
    src: string;
    type: 'image';
    version: 1;
  },
  SerializedLexicalNode
> {}

// Create a custom ImageNode class
class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__key);
  }

  constructor(src: string, key?: NodeKey) {
    super(key);
    this.__src = src;
  }

  createDOM(): HTMLElement {
    const img = document.createElement('img');
    img.src = this.__src;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    return img;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <img src={this.__src} style={{ maxWidth: '100%', height: 'auto' }} />;
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      src: this.__src,
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const node = $createImageNode(serializedNode.src);
    return node;
  }
}

export function $createImageNode(src: string): ImageNode {
  return new ImageNode(src);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

// Update ImagePastePlugin
function ImagePastePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Handle paste events
    const handlePaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) => 
        file.type.startsWith('image/')
      );

      if (imageFiles.length > 0) {
        event.preventDefault();
        editor.dispatchCommand(PASTE_FILES_COMMAND, files);
      }
    };

    // Add paste event listener to the window
    window.addEventListener('paste', handlePaste);

    const cleanup = editor.registerCommand<FileList | null>(
      PASTE_FILES_COMMAND,
      (files) => {
        if (files === null) {
          return false;
        }

        const imageFiles = Array.from(files).filter((file) => 
          file.type.startsWith('image/')
        );

        if (imageFiles.length === 0) {
          return false;
        }

        imageFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result;
            if (result && typeof result === 'string') {
              editor.update(() => {
                const imageNode = $createImageNode(result);
                const selection = $getSelection();
                if (selection) {
                  selection.insertNodes([imageNode]);
                }
              });
            }
          };
          reader.readAsDataURL(file);
        });

        return true;
      },
      COMMAND_PRIORITY_LOW
    );

    // Cleanup function to remove event listener
    return () => {
      window.removeEventListener('paste', handlePaste);
      cleanup();
    };
  }, [editor]);

  return null;
}

// Update EditorPlugins to include ImagePastePlugin
const EditorPlugins = ({ onSubmit }: { onSubmit: (markdown: string) => void }) => {
  return (
    <>
      <HistoryPlugin />
      <AutoFocusPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <KeyboardEventPlugin onSubmit={onSubmit} />
      <ImagePastePlugin />
    </>
  );
};

// Custom onChange handler
const OnChangePlugin = ({ onChange }: { onChange: (state: EditorState) => void }) => {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      onChange(editorState);
    });
  }, [editor, onChange]);
  
  return null;
};

// Update initialConfig to include ImageNode
const initialConfig = {
  namespace: 'MessagingEditor',
  // Initial editor state - empty for now
  editorState: null,
  onError: (error: Error) => {
    console.error(error);
  },
  // Register the nodes used by markdown
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    LinkNode,
    ImageNode
  ],
  // Define the theme with CSS classes
  theme: {
    ltr: 'ltr',
    rtl: 'rtl',
    paragraph: 'editor-paragraph',
    quote: 'editor-quote',
    heading: {
      h1: 'editor-heading-h1',
      h2: 'editor-heading-h2',
      h3: 'editor-heading-h3',
      h4: 'editor-heading-h4',
      h5: 'editor-heading-h5',
      h6: 'editor-heading-h6',
    },
    list: {
      nested: {
        listitem: 'editor-nested-listitem',
      },
      ol: 'editor-list-ol',
      ul: 'editor-list-ul',
      listitem: 'editor-listitem',
    },
    link: 'editor-link',
    text: {
      bold: 'editor-text-bold',
      italic: 'editor-text-italic',
      underline: 'editor-text-underline',
      strikethrough: 'editor-text-strikethrough',
      underlineStrikethrough: 'editor-text-underlineStrikethrough',
      code: 'editor-text-code',
    },
    code: 'editor-code',
    image: 'editor-image'
  },
};

// Create a custom error boundary component
class CustomErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Editor error:', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <div className="editor-error">Something went wrong with the editor.</div>;
    }
    return this.props.children;
  }
}

// Update Editor component to accept onSubmit prop
interface EditorProps {
  onSubmit: (markdown: string) => void;
}

const Editor = ({ onSubmit }: EditorProps): JSX.Element => {
  const handleEditorChange = useCallback((editorState: EditorState) => {
    // You can save the state, send to a server, etc.
    console.log('Editor changed!');
  }, []);

  return (
    <>
      <GlobalEditorStyles />
      <EditorContainer>
        <LexicalComposer initialConfig={initialConfig}>
          <EditorInner>
            <RichTextPlugin
              contentEditable={<ContentEditableStyled />}
              placeholder={<Placeholder>Type your message here... (supports markdown)</Placeholder>}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <EditorPlugins onSubmit={onSubmit} />
            <OnChangePlugin onChange={handleEditorChange} />
          </EditorInner>
        </LexicalComposer>
      </EditorContainer>
    </>
  );
};

export default Editor; 