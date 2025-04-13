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
  NodeKey,
  RangeSelection
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
  
  .editor-link-preview {
    border-radius: 6px;
    
    overflow: hidden;
  }
`;

// Styled components
const EditorContainer = styled.div`
  width: 100%;

  border-radius: 8px;
  overflow: hidden;
  margin-top: 0;
  height: calc(100% - 100px);
  display: flex;
  flex-direction: column;
`;

const EditorInner = styled.div`
  position: relative;
  padding: 15px;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  flex: 1;
`;

const ContentEditableStyled = styled(ContentEditable)`
  outline: none;
  min-height: 100%;
  width: 100%;
  
  p {
    margin: 0;
    line-height: 1.5;
  }
`;

const Placeholder = styled.div`
  color: #aaa;
  opacity: 0.3;
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

// Add YouTube URL regex
const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// Add general URL regex
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i;

// Add YouTube embed styled component
const YouTubeEmbed = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
  margin: 16px 0;
  
  iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 8px;
  }
`;

interface SerializedYouTubeNode extends Spread<
  {
    videoId: string;
    type: 'youtube';
    version: 1;
  },
  SerializedLexicalNode
> {}

// Create a custom YouTubeNode class
class YouTubeNode extends DecoratorNode<JSX.Element> {
  __videoId: string;

  static getType(): string {
    return 'youtube';
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__videoId, node.__key);
  }

  constructor(videoId: string, key?: NodeKey) {
    super(key);
    this.__videoId = videoId;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'youtube-embed';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <YouTubeEmbed>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${this.__videoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </YouTubeEmbed>
    );
  }

  exportJSON(): SerializedYouTubeNode {
    return {
      type: 'youtube',
      videoId: this.__videoId,
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedYouTubeNode): YouTubeNode {
    return $createYouTubeNode(serializedNode.videoId);
  }
}

export function $createYouTubeNode(videoId: string): YouTubeNode {
  return new YouTubeNode(videoId);
}

export function $isYouTubeNode(node: LexicalNode | null | undefined): node is YouTubeNode {
  return node instanceof YouTubeNode;
}

// Update the paste handling to include YouTube links
function handleYouTubeLink(text: string, editor: any) {
  const match = text.match(YOUTUBE_URL_REGEX);
  if (match && match[1]) {
    const videoId = match[1];
    editor.update(() => {
      const youtubeNode = $createYouTubeNode(videoId);
      const selection = $getSelection();
      if (selection) {
        selection.insertNodes([youtubeNode]);
      }
    });
    return true;
  }
  return false;
}

// Add link preview styled components
const LinkPreviewContainer = styled.div`
  border: 1px solid #e1e4e8;
  border-radius: 8px;
  overflow: hidden;
  margin: 16px 0;
  max-width: 100%;
  display: flex;
  flex-direction: row;
  background-color: #f8f9fa;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #c6cbd1;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }
`;

const LinkPreviewImage = styled.div`
  width: 180px;
  min-width: 180px;
  height: 180px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const LinkPreviewContent = styled.div`
  padding: 12px 16px;
`;

const LinkPreviewTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #24292e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LinkPreviewDescription = styled.p`
  margin: 0 0 8px;
  font-size: 14px;
  color: #586069;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LinkPreviewDomain = styled.div`
  font-size: 12px;
  color: #6a737d;
  display: flex;
  align-items: center;
  
  svg {
    margin-right: 6px;
  }
`;

interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  image: string | null;
  domain: string;
}

interface SerializedLinkPreviewNode extends Spread<
  {
    url: string;
    metadata: LinkMetadata;
    type: 'linkpreview';
    version: 1;
  },
  SerializedLexicalNode
> {}

// Create a custom LinkPreviewNode class
class LinkPreviewNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __metadata: LinkMetadata | null;

  static getType(): string {
    return 'linkpreview';
  }

  static clone(node: LinkPreviewNode): LinkPreviewNode {
    return new LinkPreviewNode(node.__url, node.__metadata, node.__key);
  }

  constructor(url: string, metadata: LinkMetadata | null = null, key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__metadata = metadata;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'editor-link-preview';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <LinkPreviewComponent url={this.__url} metadata={this.__metadata} />;
  }

  exportJSON(): SerializedLinkPreviewNode {
    return {
      type: 'linkpreview',
      url: this.__url,
      metadata: this.__metadata || {
        url: this.__url,
        title: '',
        description: '',
        image: null,
        domain: new URL(this.__url).hostname
      },
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedLinkPreviewNode): LinkPreviewNode {
    return $createLinkPreviewNode(serializedNode.url, serializedNode.metadata);
  }

  setMetadata(metadata: LinkMetadata): void {
    const self = this.getWritable();
    self.__metadata = metadata;
  }
}

export function $createLinkPreviewNode(url: string, metadata: LinkMetadata | null = null): LinkPreviewNode {
  return new LinkPreviewNode(url, metadata);
}

export function $isLinkPreviewNode(node: LexicalNode | null | undefined): node is LinkPreviewNode {
  return node instanceof LinkPreviewNode;
}

// LinkPreviewComponent that will fetch metadata if not provided
const LinkPreviewComponent = ({ url, metadata }: { url: string; metadata: LinkMetadata | null }) => {
  const [linkData, setLinkData] = useState<LinkMetadata | null>(metadata);
  const [loading, setLoading] = useState<boolean>(!metadata);
  const [error, setError] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    if (!metadata && !error) {
      setLoading(true);
      fetchLinkMetadata(url)
        .then((data) => {
          setLinkData(data);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [url, metadata, error]);

  if (loading) {
    return (
      <LinkPreviewContainer>
        <LinkPreviewContent>
          <LinkPreviewTitle>Loading preview...</LinkPreviewTitle>
          <LinkPreviewDomain>
            {new URL(url).hostname}
          </LinkPreviewDomain>
        </LinkPreviewContent>
      </LinkPreviewContainer>
    );
  }

  if (error || !linkData) {
    return (
      <LinkPreviewContainer>
        <LinkPreviewContent>
          <LinkPreviewTitle>{url}</LinkPreviewTitle>
          <LinkPreviewDomain>
            {new URL(url).hostname}
          </LinkPreviewDomain>
        </LinkPreviewContent>
      </LinkPreviewContainer>
    );
  }

  const { title, description, image, domain } = linkData;

  return (
    <LinkPreviewContainer>
      {image && !imageError && (
        <LinkPreviewImage>
          <img 
            src={image} 
            onError={() => setImageError(true)}
            alt={title}
            loading="lazy"
          />
        </LinkPreviewImage>
      )}
      <LinkPreviewContent>
        <LinkPreviewTitle>{title}</LinkPreviewTitle>
        {description && <LinkPreviewDescription>{description}</LinkPreviewDescription>}
        <LinkPreviewDomain>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 10H13V16H11V10ZM11 6H13V8H11V6Z" fill="currentColor" />
          </svg>
          {domain}
        </LinkPreviewDomain>
      </LinkPreviewContent>
    </LinkPreviewContainer>
  );
};

// Function to fetch link metadata
async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  try {
    // Use the IPC API to fetch metadata from the main process
    // This avoids CORS issues since the request is made from Node.js
    const metadata = await window.api.fetchLinkMetadata(url);
    return metadata;
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    return {
      url,
      title: url,
      description: '',
      image: null,
      domain: new URL(url).hostname
    };
  }
}

// Function to handle URL detection and link preview creation
function handleUrlPaste(text: string, editor: any) {
  // First check if it's a YouTube URL (which already has special handling)
  if (text.match(YOUTUBE_URL_REGEX)) {
    return false;
  }
  
  // Check if it's a URL
  const match = text.match(URL_REGEX);
  if (match && match[0]) {
    const url = match[0];
    editor.update(() => {
      const linkPreviewNode = $createLinkPreviewNode(url);
      const selection = $getSelection();
      if (selection) {
        selection.insertNodes([linkPreviewNode]);
      }
    });
    
    // Fetch metadata after insertion
    fetchLinkMetadata(url).then((metadata) => {
      editor.update(() => {
        // Find the link preview node we just inserted
        const root = $getRoot();
        root.getChildren().forEach((node) => {
          if ($isLinkPreviewNode(node) && node.__url === url) {
            node.setMetadata(metadata);
          }
        });
      });
    }).catch(console.error);
    
    return true;
  }
  return false;
}

// Update ImagePastePlugin to handle URL links
function ImagePastePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text');
      if (text) {
        // First check if it's a YouTube URL
        if (handleYouTubeLink(text, editor)) {
          event.preventDefault();
          return;
        }
        
        // Then check if it's a regular URL for link preview
        if (handleUrlPaste(text, editor)) {
          event.preventDefault();
          return;
        }
      }

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

interface SelectionAnchor {
  offset: number;
  key: string;
}

interface EditorSelection {
  anchor: SelectionAnchor;
}

// Add FocusPlugin to handle window focus events
const FocusPlugin = (): null => {
  const [editor] = useLexicalComposerContext();
  const lastSelectionRef = useRef<{ offset: number, key: string } | null>(null);

  useEffect(() => {
    // Store selection state when editor loses focus
    const handleBlur = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection() as EditorSelection | null;
        if (selection?.anchor) {
          lastSelectionRef.current = {
            offset: selection.anchor.offset,
            key: selection.anchor.key
          };
        }
      });
    };

    // Restore selection state when window gains focus
    const handleFocus = () => {
      if (lastSelectionRef.current) {
        editor.focus(() => {
          const { offset, key } = lastSelectionRef.current!;
          const node = editor._keyToDOMMap.get(key);
          if (node) {
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset);
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        });
      } else {
        editor.focus();
      }
    };

    window.addEventListener('focus', handleFocus);
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        lastSelectionRef.current = null;
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
    editor._rootElement?.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      editor._rootElement?.removeEventListener('blur', handleBlur);
    };
  }, [editor]);

  return null;
};

// Update initialConfig to include LinkPreviewNode
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
    ImageNode,
    YouTubeNode,
    LinkPreviewNode
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
    image: 'editor-image',
    linkpreview: 'editor-link-preview'
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
              placeholder={<Placeholder>Type here...</Placeholder>}
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

// Update EditorPlugins to include FocusPlugin
const EditorPlugins = ({ onSubmit }: { onSubmit: (markdown: string) => void }) => {
  return (
    <>
      <HistoryPlugin />
      <AutoFocusPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <KeyboardEventPlugin onSubmit={onSubmit} />
      <ImagePastePlugin />
      <FocusPlugin />
    </>
  );
};

export default Editor; 