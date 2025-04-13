import { createGlobalStyle } from 'styled-components';
import styled, { keyframes } from 'styled-components';
import { useState } from 'react';
import Editor from './components/Editor';

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
`;

const AppContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
`;

const Header = styled.header`
  text-align: center;
  margin-bottom: 30px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
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
        <Header>
          <Title>dirpad</Title>
          <Subtitle>A simple markdown notepad with rich text capabilities</Subtitle>
        </Header>
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
