import { createGlobalStyle } from 'styled-components';
import styled, { keyframes } from 'styled-components';
import { useState } from 'react';
import Editor from './components/Editor';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    height: 100vh;
    color: #fff;
  }
  
  #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
  }
`;

const AppContainer = styled.div`
  max-width: 900px;
  min-width: 300px;
  padding: 30px;
  margin: 0;
  height: 100%;
`;

const MarkdownPreview = styled.div<{ $show: boolean }>`
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  white-space: pre-wrap;
  font-family: monospace;
`;

function App(): JSX.Element {
  const [markdownPreview, setMarkdownPreview] = useState<{ text: string; show: boolean }>({ text: '', show: false });

  const handleMarkdownSubmit = (markdown: string) => {
    setMarkdownPreview({ text: markdown, show: true });
  };

  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <Editor onSubmit={handleMarkdownSubmit} />
        {markdownPreview.text && (
          <MarkdownPreview $show={markdownPreview.show}>
            {markdownPreview.text}
          </MarkdownPreview>
        )}
      </AppContainer>
    </>
  );
}

export default App;
